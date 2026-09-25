"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBookingStore } from "@/store/useBookingStore";
import { motion } from "framer-motion";
import { Clock, Scissors, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number | null;
}

export function ServicePicker() {
  const { selectedService, setSelectedService } = useBookingStore();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchServices() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("services")
          .select("*")
          .order("duration", { ascending: true });
        if (error) throw error;
        setServices(data || []);
      } catch (err: any) {
        setError(err.message || "فشل في تحميل الخدمات");
      } finally {
        setLoading(false);
      }
    }
    fetchServices();
  }, []);

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
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-12" dir="rtl">
        <p className="text-gray-600 dark:text-gray-400">
          لا توجد خدمات متاحة حالياً.
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl">
      <h2 className="text-2xl font-bold mb-6">اختر الخدمة</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {services.map((service) => {
          const isSelected = selectedService?.id === service.id;
          return (
            <motion.button
              key={service.id}
              type="button"
              onClick={() =>
                setSelectedService({
                  id: service.id,
                  name: service.name,
                  duration: service.duration,
                })
              }
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "text-left glass rounded-xl p-6 border-2 transition-all",
                isSelected
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-transparent hover:border-amber-500/50"
              )}
            >
              <div className="flex items-center mb-3">
                <Scissors className="text-amber-500 ml-3" size={24} />
                <h3 className="text-xl font-bold">{service.name}</h3>
              </div>
              {service.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                  {service.description}
                </p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center text-amber-500">
                  <Clock size={18} className="ml-2" />
                  <span className="font-semibold">
                    {service.duration} دقيقة
                  </span>
                </div>
                {service.price !== null && (
                  <span className="text-lg font-bold">
                    {service.price.toFixed(2)} د.ج
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}