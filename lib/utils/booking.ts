import { format, addMinutes, parse, set } from "date-fns";

/** Granularity for offering candidate start times. Code constant, not stored. */
export const SLOT_STEP_MINUTES = 30;

export interface TimeWindow {
  /** "HH:mm" or "HH:mm:ss" */
  startTime: string;
  /** "HH:mm" or "HH:mm:ss" */
  endTime: string;
}

export interface ExistingBooking {
  start_time: string; // "HH:mm:ss"
  end_time: string;   // "HH:mm:ss"
}

export interface TimeOffRow {
  date: string;            // "yyyy-MM-dd"
  start_time: string | null;
  end_time: string | null;
}

export interface GenerateSlotsArgs {
  date: Date;
  window: TimeWindow;
  serviceDuration: number; // minutes
  bookings: ExistingBooking[];
  timeOff: TimeOffRow[];
}

/**
 * Compute candidate start times for a given date + service duration.
 *
 * Rules:
 *   - Candidate starts step by SLOT_STEP_MINUTES from window.startTime.
 *   - [start, start + serviceDuration] must fit entirely inside the window.
 *   - Must not overlap any booking (pending/confirmed) on that date.
 *   - Must not overlap any time_off block on that date.
 *   - A full-day time_off row (start_time & end_time null) blocks the whole day.
 */
export function generateTimeSlots({
  date,
  window,
  serviceDuration,
  bookings,
  timeOff,
}: GenerateSlotsArgs): Array<{ time: string; available: boolean }> {
  const dateStr = format(date, "yyyy-MM-dd");

  const [startH, startM] = window.startTime.split(":").map(Number);
  const [endH, endM] = window.endTime.split(":").map(Number);

  const dayStart = set(date, {
    hours: startH,
    minutes: startM,
    seconds: 0,
    milliseconds: 0,
  });
  const dayEnd = set(date, {
    hours: endH,
    minutes: endM,
    seconds: 0,
    milliseconds: 0,
  });

  // Pre-parse bookings on this date into minute intervals
  const bookingIntervals = bookings.map((b) => {
    const bs = parse(b.start_time, "HH:mm:ss", date);
    const be = parse(b.end_time, "HH:mm:ss", date);
    return { start: bs, end: be };
  });

  // Pre-parse time_off rows for this date
  const offIntervals = timeOff
    .filter((t) => t.date === dateStr)
    .map((t) => {
      if (t.start_time === null || t.end_time === null) {
        return { start: dayStart, end: dayEnd }; // full day off
      }
      return {
        start: parse(t.start_time, "HH:mm:ss", date),
        end: parse(t.end_time, "HH:mm:ss", date),
      };
    });

  const slots: Array<{ time: string; available: boolean }> = [];

  let cursor = dayStart;

  while (true) {
    const slotStart = cursor;
    const slotEnd = addMinutes(slotStart, serviceDuration);

    // Must fit entirely inside the working window
    if (slotEnd.getTime() > dayEnd.getTime()) break;

    const overlapsBooking = bookingIntervals.some(
      (b) => slotStart < b.end && slotEnd > b.start
    );
    const overlapsTimeOff = offIntervals.some(
      (o) => slotStart < o.end && slotEnd > o.start
    );

    slots.push({
      time: format(slotStart, "HH:mm"),
      available: !overlapsBooking && !overlapsTimeOff,
    });

    cursor = addMinutes(cursor, SLOT_STEP_MINUTES);
  }

  return slots;
}

export function formatBookingTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  return set(date, { hours, minutes, seconds: 0, milliseconds: 0 });
}