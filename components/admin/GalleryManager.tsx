"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

interface GalleryManagerProps {
  barberId: string;
}

export function GalleryManager({ barberId }: GalleryManagerProps) {
  const [images, setImages] = useState<Array<{ name: string; url: string }>>(
    []
  );
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (barberId) {
      fetchImages();
    }
  }, [barberId]);

  async function fetchImages() {
    setLoading(true);
    try {
      const supabase = createClient();

      // Use barber-specific folder
      const folderPath = `${barberId}/`;
      const { data, error: listError } = await supabase.storage
        .from("haircut-gallery")
        .list(folderPath, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (listError) throw listError;

      const imagesWithUrls = (data || [])
        .filter((img) => img.name.match(/\.(jpg|jpeg|png|gif|webp)$/i))
        .map((image) => {
          const imagePath = `${folderPath}${image.name}`;
          const { data: urlData } = supabase.storage
            .from("haircut-gallery")
            .getPublicUrl(imagePath);
          return {
            name: image.name,
            url: urlData.publicUrl,
            fullPath: imagePath,
          };
        });

      setImages(imagesWithUrls);
    } catch (err: any) {
      setError(err.message || "فشل في تحميل الصور");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();

      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          setError(`${file.name} ليس ملف صورة`);
          continue;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          setError(`${file.name} كبير جدًا. الحد الأقصى 5 ميجابايت`);
          continue;
        }

        // Generate unique filename
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.${fileExt}`;

        // Check if user is authenticated
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("يجب تسجيل الدخول لتحميل الصور");
          continue;
        }

        // Upload to barber-specific folder
        const folderPath = `${barberId}/`;
        const filePath = `${folderPath}${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("haircut-gallery")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error details:", uploadError);
          setError(
            `فشل في تحميل ${file.name}: ${uploadError.message}. تأكد من إعداد سياسات التخزين بشكل صحيح.`
          );
          continue;
        }
      }

      // Refresh image list
      await fetchImages();
      // Clear input
      e.target.value = "";
    } catch (err: any) {
      setError(err.message || "فشل في تحميل الصور");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(imageName: string, fullPath?: string) {
    if (!confirm("هل أنت متأكد من حذف هذه الصورة؟")) return;

    try {
      const supabase = createClient();
      // Use fullPath if available, otherwise construct it
      const imagePath = fullPath || `${barberId}/${imageName}`;
      const { error } = await supabase.storage
        .from("haircut-gallery")
        .remove([imagePath]);

      if (error) throw error;

      await fetchImages();
    } catch (err: any) {
      setError(err.message || "فشل في حذف الصورة");
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12" dir="rtl">
        <Loader2 className="animate-spin text-amber-500 mx-auto" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-2xl font-bold mb-4">إدارة معرض الصور</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          قم بتحميل وإدارة صور معرضك
        </p>
      </div>

      {/* Upload Section */}
      <div className="glass rounded-xl p-6">
        <label className="block mb-4">
          <span className="block text-sm font-medium mb-2">تحميل الصور</span>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 cursor-pointer hover:border-amber-500 transition-colors",
                uploading && "opacity-50 cursor-not-allowed"
              )}
            >
              <Upload size={20} />
              {uploading ? "جاري التحميل..." : "اختر الصور"}
            </label>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              الحد الأقصى 5 ميجابايت لكل صورة. يدعم JPG، PNG، GIF، WebP
            </span>
          </div>
        </label>

        {error && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Images Grid */}
      {images.length === 0 ? (
        <div className="text-center py-12 glass rounded-xl">
          <ImageIcon className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-gray-600 dark:text-gray-400">
            لم يتم تحميل أي صور بعد. قم بتحميل صورتك الأولى للبدء!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image, index) => (
            <motion.div
              key={image.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="glass rounded-xl overflow-hidden aspect-square relative group"
            >
              <Image
                src={image.url}
                alt={`صورة المعرض ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              <button
                onClick={() =>
                  handleDelete(image.name, (image as any).fullPath)
                }
                className="absolute top-2 left-2 p-2 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="حذف الصورة"
              >
                <X size={16} className="text-white" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}