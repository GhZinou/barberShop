"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface BarberSetupProps {
  userId: string;
}

export function BarberSetup({ userId }: BarberSetupProps) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { error: profileError } = await supabase
        .from("barber_profile")
        // @ts-ignore - Supabase type inference issue with string literal table names
        .insert({
          user_id: userId,
          name,
          bio: bio || null,
          experience_years: experienceYears ? parseInt(experienceYears) : null,
        });

      if (profileError) throw profileError;

      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "فشل في إنشاء الملف الشخصي");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8 max-w-md w-full"
      >
        <h1 className="text-3xl font-bold mb-2 text-center">
          إعداد ملفك الشخصي
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
          أكمل ملفك الشخصي كحلاق للبدء
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              الاسم <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder="اسمك"
            />
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium mb-2">
              نبذة تعريفية
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder="أخبرنا عن نفسك..."
            />
          </div>

          <div>
            <label
              htmlFor="experience"
              className="block text-sm font-medium mb-2"
            >
              سنوات الخبرة
            </label>
            <input
              id="experience"
              type="number"
              min="0"
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder="5"
            />
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
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
                <Loader2 className="ml-2 animate-spin" size={20} />
                جاري إنشاء الملف الشخصي...
              </>
            ) : (
              "إكمال الإعداد"
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}