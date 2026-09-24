"use client";

import { useEffect, useState } from "react";
import { useBookingStore } from "@/store/useBookingStore";
import { createClient } from "@/lib/supabase/client";
import { format, addDays, startOfDay, isBefore, isAfter } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { generateTimeSlots } from "@/lib/utils/booking";

export function DatePicker() {
  const { selectedService, selectedDate, setSelectedDate } = useBookingStore();
  const [viewDate] = useState(new Date());
  const [disabledDays, setDisabledDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const today = startOfDay(new Date());
  const maxDate = addDays(today, 60);
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  useEffect(() => {
    async function computeDisabled() {
      if (!selectedService) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const supabase = createClient();

        // Resolve barber (first one)
        const { data: barber } = await supabase
          .from("barber_profile")
          .select("id")
          .limit(1)
          .single();

        if (!barber) {
          setDisabledDays(new Set(dates.map((d) => format(d, "yyyy-MM-dd"))));
          setLoading(false);
          return;
        }
        const barberId = (barber as { id: string }).id;

        // Load availability, bookings in range, time_off in range
        const startStr = format(dates[0], "yyyy-MM-dd");
        const endStr = format(dates[dates.length - 1], "yyyy-MM-dd");

        const [availRes, bookingsRes, timeOffRes] = await Promise.all([
          supabase
            .from("availability")
            .select("day_of_week, start_time, end_time, is_active")
            .eq("barber_id", barberId)
            .eq("is_active", true),
          supabase
            .from("bookings")
            .select("date, start_time, end_time")
            .eq("barber_id", barberId)
            .gte("date", startStr)
            .lte("date", endStr)
            .in("status", ["pending", "confirmed"]),
          supabase
            .from("time_off")
            .select("date, start_time, end_time")
            .eq("barber_id", barberId)
            .gte("date", startStr)
            .lte("date", endStr),
        ]);

        const availability = (availRes.data || []) as Array<{
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_active: boolean;
        }>;
        const bookings = (bookingsRes.data || []) as Array<{
          date: string;
          start_time: string;
          end_time: string;
        }>;
        const timeOff = (timeOffRes.data || []) as Array<{
          date: string;
          start_time: string | null;
          end_time: string | null;
        }>;

        const disabled = new Set<string>();

        for (const d of dates) {
          const dow = d.getDay();
          const avail = availability.find((a) => a.day_of_week === dow);
          const dateStr = format(d, "yyyy-MM-dd");

          if (!avail) {
            disabled.add(dateStr);
            continue;
          }

          const dayBookings = bookings.filter((b) => b.date === dateStr);
          const dayOff = timeOff.filter((t) => t.date === dateStr);

          const slots = generateTimeSlots({
            date: d,
            window: { startTime: avail.start_time, endTime: avail.end_time },
            serviceDuration: selectedService.duration,
            bookings: dayBookings,
            timeOff: dayOff,
          });

          if (!slots.some((s) => s.available)) {
            disabled.add(dateStr);
          }
        }

        setDisabledDays(disabled);
      } catch (err) {
        console.error("Error computing disabled dates:", err);
      } finally {
        setLoading(false);
      }
    }

    computeDisabled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService]);

  const handleDateSelect = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    if (disabledDays.has(dateStr)) return;
    if (!isBefore(date, today) && !isAfter(date, maxDate)) {
      setSelectedDate(date);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
        {dates.map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const isSelected =
            selectedDate && format(selectedDate, "yyyy-MM-dd") === dateStr;
          const isPast = isBefore(date, today);
          const isTooFar = isAfter(date, maxDate);
          const isDisabled = isPast || isTooFar || disabledDays.has(dateStr);

          return (
            <motion.button
              key={date.toISOString()}
              onClick={() => handleDateSelect(date)}
              disabled={isDisabled || loading}
              whileHover={{ scale: isDisabled ? 1 : 1.05 }}
              whileTap={{ scale: isDisabled ? 1 : 0.95 }}
              className={cn(
                "relative p-4 rounded-lg border-2 transition-all",
                isSelected
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-gray-300 dark:border-gray-700 hover:border-amber-500/50",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {format(date, "EEE")}
              </div>
              <div
                className={cn(
                  "text-lg font-bold mt-1",
                  isSelected ? "text-amber-500" : ""
                )}
              >
                {format(date, "d")}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {format(date, "MMM")}
              </div>
              {disabledDays.has(dateStr) && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500" />
              )}
            </motion.button>
          );
        })}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
        Red dot means the day is unavailable for this service.
      </p>
    </div>
  );
}