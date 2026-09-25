"use client";

import { useState, useEffect } from "react";
import { useBookingStore } from "@/store/useBookingStore";
import { createClient } from "@/lib/supabase/client";
import { generateTimeSlots } from "@/lib/utils/booking";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { Loader2 } from "lucide-react";

interface TimeSlotPickerProps {
  date: Date;
}

export function TimeSlotPicker({ date }: TimeSlotPickerProps) {
  const { selectedService, selectedTime, setSelectedTime } = useBookingStore();
  const [slots, setSlots] = useState<Array<{ time: string; available: boolean }>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSlots() {
      if (!selectedService) {
        setError("لم يتم اختيار خدمة.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();

        const { data: barber } = await supabase
          .from("barber_profile")
          .select("id")
          .limit(1)
          .single();

        if (!barber) {
          setError("لم يتم العثور على ملف الحلاق.");
          setLoading(false);
          return;
        }
        const barberId = (barber as { id: string }).id;

        const dayOfWeek = date.getDay();
        const { data: availability } = await supabase
          .from("availability")
          .select("start_time, end_time")
          .eq("barber_id", barberId)
          .eq("day_of_week", dayOfWeek)
          .eq("is_active", true)
          .single();

        if (!availability) {
          setError("لا يوجد توفر لهذا اليوم.");
          setLoading(false);
          return;
        }

        const dateStr = format(date, "yyyy-MM-dd");

        const [bookingsRes, timeOffRes] = await Promise.all([
          supabase
            .from("bookings")
            .select("start_time, end_time")
            .eq("barber_id", barberId)
            .eq("date", dateStr)
            .in("status", ["pending", "confirmed"]),
          supabase
            .from("time_off")
            .select("date, start_time, end_time")
            .eq("barber_id", barberId)
            .eq("date", dateStr),
        ]);

        const bookings = (bookingsRes.data || []) as Array<{
          start_time: string;
          end_time: string;
        }>;
        const timeOff = (timeOffRes.data || []) as Array<{
          date: string;
          start_time: string | null;
          end_time: string | null;
        }>;

        const computed = generateTimeSlots({
          date,
          window: {
            startTime: (availability as any).start_time,
            endTime: (availability as any).end_time,
          },
          serviceDuration: selectedService.duration,
          bookings,
          timeOff,
        });

        setSlots(computed);
      } catch (err) {
        console.error(err);
        setError("فشل في تحميل الأوقات المتاحة.");
      } finally {
        setLoading(false);
      }
    }

    fetchSlots();
  }, [date, selectedService]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" dir="rtl">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12" dir="rtl">
        <p className="text-red-500 mb-4">{error}</p>
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available);

  if (availableSlots.length === 0) {
    return (
      <div className="text-center py-12" dir="rtl">
        <p className="text-xl font-semibold mb-2">محجوز بالكامل</p>
        <p className="text-gray-600 dark:text-gray-400">
          لا توجد أوقات متاحة لهذه الخدمة في هذا التاريخ.
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {slots.map((slot) => (
          <motion.button
            key={slot.time}
            onClick={() => slot.available && setSelectedTime(slot.time)}
            disabled={!slot.available}
            whileHover={slot.available ? { scale: 1.05 } : {}}
            whileTap={slot.available ? { scale: 0.95 } : {}}
            className={cn(
              "p-3 rounded-lg border-2 transition-all text-sm font-medium",
              slot.available
                ? selectedTime === slot.time
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-gray-300 dark:border-gray-700 hover:border-amber-500/50"
                : "border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 text-gray-400 cursor-not-allowed opacity-50"
            )}
          >
            {slot.time}
          </motion.button>
        ))}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
        {availableSlots.length} موعد متاح
      </p>
    </div>
  );
}