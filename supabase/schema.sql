-- ============================================================================
-- BARBER SHOP BOOKING SYSTEM — SCHEMA
-- ----------------------------------------------------------------------------
-- Run this on a fresh Supabase project (empty database).
-- Creates the complete final database structure in one pass.
--
-- Contents:
--   1. Extensions
--   2. Tables (barber_profile, clients, services, availability, bookings, time_off)
--   3. Indexes
--   4. updated_at trigger function + triggers
--   5. Overlap prevention function + trigger
--   6. Row Level Security (RLS) — all tables
--   7. Storage bucket + policies
-- ============================================================================


-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- barber_profile
-- One row per barber. Each barber is linked to an auth.users row.
-- Multiple barbers are supported: UNIQUE(user_id) allows many barbers.
-- ---------------------------------------------------------------------------
CREATE TABLE barber_profile (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  bio               TEXT,
  experience_years  INTEGER,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id)
);

-- ---------------------------------------------------------------------------
-- clients
-- A client is anyone who books. Can be linked to auth.users (logged-in)
-- or user_id NULL (guest booking).
-- ---------------------------------------------------------------------------
CREATE TABLE clients (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  photo_url   TEXT,
  notes       TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- services
-- Offered services (Haircut, Beard trim, etc.). Read-only for clients.
-- The duration (in minutes) is the source of truth for how long a booking
-- occupies the barber's schedule. Empty by default — added via SQL or admin.
-- ---------------------------------------------------------------------------
CREATE TABLE services (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  description  TEXT,
  duration     INTEGER NOT NULL DEFAULT 30 CHECK (duration > 0),
  price        DECIMAL(10, 2) CHECK (price IS NULL OR price >= 0),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- availability
-- Weekly recurring working hours, one row per (barber, day-of-week).
-- day_of_week: 0 = Sunday, 6 = Saturday
-- is_active = false means the barber does not work that weekday.
--
-- NOTE: This table only defines the working WINDOW (start_time .. end_time).
-- It does NOT define slots. Slots are computed on the fly from the selected
-- service's duration (services.duration) minus existing bookings and time_off.
-- ---------------------------------------------------------------------------
CREATE TABLE availability (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barber_id      UUID NOT NULL REFERENCES barber_profile(id) ON DELETE CASCADE,
  day_of_week    INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (barber_id, day_of_week),
  CONSTRAINT availability_times_ordered CHECK (end_time > start_time)
);

-- ---------------------------------------------------------------------------
-- bookings
-- A booking reserves a time window for a specific barber on a specific date,
-- for a specific service.
-- Overlap prevention is enforced by a trigger (defined later).
-- ---------------------------------------------------------------------------
CREATE TABLE bookings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  barber_id   UUID NOT NULL REFERENCES barber_profile(id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes       TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT bookings_times_ordered CHECK (end_time > start_time)
);

-- ---------------------------------------------------------------------------
-- time_off
-- A barber's block-out for a specific date (sick day, vacation, etc.).
--   - start_time and end_time both NULL  → full day off
--   - start_time and end_time both set   → partial day off
-- One row per (barber_id, date).
-- ---------------------------------------------------------------------------
CREATE TABLE time_off (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barber_id   UUID NOT NULL REFERENCES barber_profile(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME,
  end_time    TIME,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (barber_id, date),
  CONSTRAINT time_off_times_consistent CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL)
  ),
  CONSTRAINT time_off_times_ordered CHECK (
    start_time IS NULL OR end_time > start_time
  )
);


-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX idx_bookings_date          ON bookings (date);
CREATE INDEX idx_bookings_barber_date   ON bookings (barber_id, date);
CREATE INDEX idx_bookings_client        ON bookings (client_id);
CREATE INDEX idx_bookings_service       ON bookings (service_id);
CREATE INDEX idx_availability_barber    ON availability (barber_id);
CREATE INDEX idx_clients_user_id        ON clients (user_id);
CREATE INDEX idx_time_off_barber_date   ON time_off (barber_id, date);


-- ============================================================================
-- 4. updated_at TRIGGER
-- Keeps the updated_at column fresh on every UPDATE.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_barber_profile_updated_at
  BEFORE UPDATE ON barber_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_availability_updated_at
  BEFORE UPDATE ON availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_off_updated_at
  BEFORE UPDATE ON time_off
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 5. OVERLAP PREVENTION (double-booking guard)
-- ----------------------------------------------------------------------------
-- Runs before every INSERT or UPDATE on bookings.
-- Raises an exception if the new booking would overlap an existing
-- pending/confirmed booking for the same barber on the same date.
--
-- Interval overlap, canonical form:
--   Two intervals [a_start, a_end) and [b_start, b_end) overlap iff
--   a_start < b_end  AND  a_end > b_start
-- ============================================================================

CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM bookings
    WHERE barber_id = NEW.barber_id
      AND date = NEW.date
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status IN ('pending', 'confirmed')
      AND NEW.start_time < end_time
      AND NEW.end_time > start_time
  ) THEN
    RAISE EXCEPTION 'Booking time slot is already taken. Please select another time.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_overlapping_bookings
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_booking_overlap();


-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE barber_profile  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability    ENABLE ROW LEVEL SECURITY;
ALTER TABLE services        ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off        ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- barber_profile
-- ---------------------------------------------------------------------------

CREATE POLICY "Barber profiles are viewable by everyone"
  ON barber_profile FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own barber profile"
  ON barber_profile FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own barber profile"
  ON barber_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

CREATE POLICY "Clients are viewable by barbers and themselves"
  ON clients FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM barber_profile
      WHERE barber_profile.user_id = auth.uid()
    )
  );

-- Guest bookings: unauthenticated insert allowed (user_id IS NULL).
-- Logged-in clients: user_id must match their auth.uid().
CREATE POLICY "Users can insert their own client profile"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can update their own client profile"
  ON clients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Barbers can update any client"
  ON clients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM barber_profile
      WHERE barber_profile.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

-- A booking is readable only by:
--   - the barber who owns it, or
--   - the logged-in client who made it.
-- Anonymous reads are NOT allowed (privacy).
CREATE POLICY "Bookings are viewable by barbers and clients"
  ON bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM barber_profile
      WHERE barber_profile.id = bookings.barber_id
        AND barber_profile.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = bookings.client_id
        AND clients.user_id = auth.uid()
    )
  );

-- Anyone (including guests) can create a booking, but the row is validated:
--   - client must exist
--   - barber must exist
--   - service must exist
--   - date must not be in the past
--   - status must be a valid starting status
CREATE POLICY "Anyone can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = bookings.client_id
    )
    AND EXISTS (
      SELECT 1 FROM barber_profile
      WHERE barber_profile.id = bookings.barber_id
    )
    AND EXISTS (
      SELECT 1 FROM services
      WHERE services.id = bookings.service_id
    )
    AND bookings.date >= CURRENT_DATE
    AND bookings.status IN ('pending', 'confirmed')
  );

CREATE POLICY "Barbers can update bookings"
  ON bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM barber_profile
      WHERE barber_profile.id = bookings.barber_id
        AND barber_profile.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM barber_profile
      WHERE barber_profile.id = bookings.barber_id
        AND barber_profile.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- availability
-- ---------------------------------------------------------------------------

CREATE POLICY "Availability is viewable by everyone"
  ON availability FOR SELECT
  USING (true);

CREATE POLICY "Barbers can manage their own availability"
  ON availability FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM barber_profile
      WHERE barber_profile.id = availability.barber_id
        AND barber_profile.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM barber_profile
      WHERE barber_profile.id = availability.barber_id
        AND barber_profile.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------

CREATE POLICY "Services are viewable by everyone"
  ON services FOR SELECT
  USING (true);

-- No client-side write policy: services are managed via SQL only.


-- ---------------------------------------------------------------------------
-- time_off
-- ---------------------------------------------------------------------------

-- Public read: the booking flow needs to filter blocked slots
-- for anonymous visitors too.
CREATE POLICY "Time off is viewable by everyone"
  ON time_off FOR SELECT
  USING (true);

CREATE POLICY "Barbers can insert their own time off"
  ON time_off FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM barber_profile
      WHERE barber_profile.id = time_off.barber_id
        AND barber_profile.user_id = auth.uid()
    )
  );

CREATE POLICY "Barbers can update their own time off"
  ON time_off FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM barber_profile
      WHERE barber_profile.id = time_off.barber_id
        AND barber_profile.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM barber_profile
      WHERE barber_profile.id = time_off.barber_id
        AND barber_profile.user_id = auth.uid()
    )
  );

CREATE POLICY "Barbers can delete their own time off"
  ON time_off FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM barber_profile
      WHERE barber_profile.id = time_off.barber_id
        AND barber_profile.user_id = auth.uid()
    )
  );


-- ============================================================================
-- 7. STORAGE — haircut-gallery bucket + policies
-- ============================================================================

-- Create the bucket: public, 5MB limit, image MIME types only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'haircut-gallery',
  'haircut-gallery',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Policy 1 — Anyone can view files in the bucket.
CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'haircut-gallery');

-- Policy 2 — Authenticated users can upload files to the bucket.
CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'haircut-gallery');

-- Policy 3 — Authenticated users can delete files from the bucket.
CREATE POLICY "Authenticated users can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'haircut-gallery');


-- ============================================================================
-- END OF SCHEMA
-- ============================================================================