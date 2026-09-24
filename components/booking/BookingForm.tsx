"use client";

import { useState } from "react";
import { format, addMinutes } from "date-fns";
import { formatBookingTime } from "@/lib/utils/booking";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useBookingStore } from "@/store/useBookingStore";

interface BookingFormProps {
  date: Date;
  time: string;
  onComplete: (bookingId: string) => void;
}

export function BookingForm({ date, time, onComplete }: BookingFormProps) {
  const { selectedService } = useBookingStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) {
      setError("No service selected.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Resolve barber (first)
      const { data: barber } = await supabase
        .from("barber_profile")
        .select("id")
        .limit(1)
        .single();

      if (!barber) throw new Error("Barber profile not found.");
      const barberId = (barber as { id: string }).id;

      // Get or create client
      let clientId: string;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (existingClient) {
          clientId = (existingClient as { id: string }).id;
          await supabase
            .from("clients")
            .update({
              name,
              email: email || null,
              phone: phone || null,
            })
            .eq("id", clientId);
        } else {
          const { data: newClient, error: clientError } = await supabase
            .from("clients")
            .insert({
              user_id: user.id,
              name,
              email: email || null,
              phone: phone || null,
            })
            .select("id")
            .single();

          if (clientError || !newClient) {
            throw new Error("Failed to create client profile");
          }
          clientId = (newClient as { id: string }).id;
        }
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            name,
            email: email || null,
            phone: phone || null,
          })
          .select("id")
          .single();

        if (clientError || !newClient) {
          throw new Error("Failed to create client profile");
        }
        clientId = (newClient as { id: string }).id;
      }

      // Compute end_time from the chosen service
      const startDateTime = formatBookingTime(date, time);
      const endDateTime = addMinutes(startDateTime, selectedService.duration);

      const dateStr = format(date, "yyyy-MM-dd");
      const startTimeStr = format(startDateTime, "HH:mm:ss");
      const endTimeStr = format(endDateTime, "HH:mm:ss");

      // Final overlap re-check (defensive, in case another booking landed)
      const { data: existingBookings, error: checkError } = await supabase
        .from("bookings")
        .select("id, start_time, end_time")
        .eq("barber_id", barberId)
        .eq("date", dateStr)
        .in("status", ["pending", "confirmed"]);

      if (checkError) throw new Error("Failed to check availability");

      const hasOverlap = (existingBookings || []).some((b: any) => {
        const existingStart = new Date(`${dateStr}T${b.start_time}`);
        const existingEnd = new Date(`${dateStr}T${b.end_time}`);
        const requestedStart = new Date(`${dateStr}T${startTimeStr}`);
        const requestedEnd = new Date(`${dateStr}T${endTimeStr}`);
        return requestedStart < existingEnd && requestedEnd > existingStart;
      });

      if (hasOverlap) {
        throw new Error(
          "This time slot has just been booked by someone else. Please select another time."
        );
      }

      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          client_id: clientId,
          barber_id: barberId,
          service_id: selectedService.id,
          date: dateStr,
          start_time: startTimeStr,
          end_time: endTimeStr,
          status: "confirmed",
          notes: notes || null,
        })
        .select("id")
        .single();

      if (bookingError || !booking) {
        if (
          bookingError?.message?.includes("overlap") ||
          bookingError?.message?.includes("conflict")
        ) {
          throw new Error(
            "This time slot has just been booked. Please select another time."
          );
        }
        throw new Error("Failed to create booking");
      }

      const bookingId = (booking as { id: string }).id;

      fetch("/api/bookings/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      }).catch((err) => {
        console.error("Failed to send notification:", err);
      });

      onComplete(bookingId);
    } catch (err: any) {
      setError(err.message || "Failed to create booking. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          placeholder="Your full name"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          placeholder="your.email@example.com"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium mb-2">
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          placeholder="(555) 123-4567"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-2">
          Special Requests or Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          placeholder="Any special requests or notes for your appointment..."
        />
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || !name}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 animate-spin" size={20} />
            Booking...
          </>
        ) : (
          "Confirm Booking"
        )}
      </Button>
    </form>
  );
}