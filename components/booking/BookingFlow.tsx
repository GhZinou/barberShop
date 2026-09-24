"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useBookingStore } from "@/store/useBookingStore";
import { ServicePicker } from "./ServicePicker";
import { DatePicker } from "./DatePicker";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { BookingForm } from "./BookingForm";
import { BookingConfirmation } from "./BookingConfirmation";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

type BookingStep = "service" | "date" | "time" | "details" | "confirmation";

export function BookingFlow() {
  const searchParams = useSearchParams();
  const serviceParam = searchParams.get("service");

  const {
    selectedService,
    setSelectedService,
    selectedDate,
    selectedTime,
    setSelectedDate,
    setSelectedTime,
    reset,
  } = useBookingStore();

  const [step, setStep] = useState<BookingStep>(
    serviceParam ? "date" : "service"
  );
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const [preloading, setPreloading] = useState(!!serviceParam);

  // Preload service if ?service=<id> in URL
  useEffect(() => {
    async function preload() {
      if (!serviceParam) {
        setPreloading(false);
        return;
      }
      if (selectedService?.id === serviceParam) {
        setPreloading(false);
        return;
      }
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("services")
          .select("id, name, duration")
          .eq("id", serviceParam)
          .single();
        if (data) {
          setSelectedService({
            id: (data as any).id,
            name: (data as any).name,
            duration: (data as any).duration,
          });
          setStep("date");
        } else {
          // Bad service id — fall back to service step
          setStep("service");
        }
      } catch (err) {
        console.error("Error preloading service:", err);
        setStep("service");
      } finally {
        setPreloading(false);
      }
    }
    preload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceParam]);

  // Auto-advance logic
  useEffect(() => {
    if (isNavigatingBack) return;
    if (selectedService && step === "service") {
      setStep("date");
    }
    if (selectedDate && step === "date" && !selectedTime) {
      setStep("time");
    }
    if (selectedTime && step === "time") {
      setStep("details");
    }
  }, [
    selectedService,
    selectedDate,
    selectedTime,
    step,
    isNavigatingBack,
  ]);

  const handleBookingComplete = (id: string) => {
    setBookingId(id);
    setStep("confirmation");
  };

  const handleReset = () => {
    reset();
    setStep("service");
    setBookingId(null);
  };

  if (preloading) {
    return (
      <div className="glass rounded-2xl p-8 text-center py-16">
        <Loader2 className="animate-spin text-amber-500 mx-auto" size={32} />
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-8">
      <AnimatePresence mode="wait">
        {step === "service" && (
          <motion.div
            key="service"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ServicePicker />
          </motion.div>
        )}

        {step === "date" && (
          <motion.div
            key="date"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {selectedService && (
              <div className="mb-6">
                <button
                  onClick={() => {
                    if (serviceParam) return; // came in with fixed service
                    setIsNavigatingBack(true);
                    setSelectedService(null);
                    setSelectedDate(null);
                    setSelectedTime(null);
                    setStep("service");
                    setTimeout(() => setIsNavigatingBack(false), 100);
                  }}
                  className="text-amber-500 hover:text-amber-600 mb-4 flex items-center gap-2"
                >
                  ← Change service
                </button>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Service: {selectedService.name} · {selectedService.duration}{" "}
                  min
                </p>
              </div>
            )}
            <h2 className="text-2xl font-bold mb-6">Select Date</h2>
            <DatePicker />
          </motion.div>
        )}

        {step === "time" && selectedDate && (
          <motion.div
            key="time"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="mb-6">
              <button
                onClick={() => {
                  setIsNavigatingBack(true);
                  setSelectedTime(null);
                  setSelectedDate(null);
                  setStep("date");
                  setTimeout(() => setIsNavigatingBack(false), 100);
                }}
                className="text-amber-500 hover:text-amber-600 mb-4 flex items-center gap-2"
              >
                ← Change date
              </button>
              <h2 className="text-2xl font-bold mb-2">Select Time</h2>
              <p className="text-gray-600 dark:text-gray-400">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </p>
            </div>
            <TimeSlotPicker date={selectedDate} />
          </motion.div>
        )}

        {step === "details" && selectedDate && selectedTime && (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="mb-6">
              <button
                onClick={() => {
                  setIsNavigatingBack(true);
                  setSelectedTime(null);
                  setStep("time");
                  setTimeout(() => setIsNavigatingBack(false), 100);
                }}
                className="text-amber-500 hover:text-amber-600 mb-4 flex items-center gap-2"
              >
                ← Change time
              </button>
              <h2 className="text-2xl font-bold mb-2">Your Details</h2>
              <p className="text-gray-600 dark:text-gray-400">
                {format(selectedDate, "EEEE, MMMM d, yyyy")} at {selectedTime}
              </p>
            </div>
            <BookingForm
              date={selectedDate}
              time={selectedTime}
              onComplete={handleBookingComplete}
            />
          </motion.div>
        )}

        {step === "confirmation" && bookingId && (
          <motion.div
            key="confirmation"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <BookingConfirmation
              bookingId={bookingId}
              onReset={handleReset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}