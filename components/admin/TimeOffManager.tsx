"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { ar } from "date-fns/locale";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import {
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  CalendarOff,
} from "lucide-react";
import { Database } from "@/types/database";

type TimeOffRow = Database["public"]["Tables"]["time_off"]["Row"];

interface TimeOffManagerProps {
  barberId: string;
}

export function TimeOffManager({ barberId }: TimeOffManagerProps) {
  const [rows, setRows] = useState<TimeOffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Add form
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState("");

  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    fetchTimeOff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberId]);

  async function fetchTimeOff() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("time_off")
        .select("*")
        .eq("barber_id", barberId)
        .order("date", { ascending: true });

      if (error) throw error;
      setRows(data || []);
    } catch (err: any) {
      setError(err.message || "فشل في تحميل أيام الإجازة");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const from = startDate;
      const to = endDate && endDate >= startDate ? endDate : startDate;

      // Build the list of dates in the range
      const allDates = eachDayOfInterval({
        start: parseISO(from),
        end: parseISO(to),
      }).map((d) => format(d, "yyyy-MM-dd"));

      // Filter out dates that already exist in state
      const existing = new Set(rows.map((r) => r.date));
      const toInsert = allDates.filter((d) => !existing.has(d));

      if (toInsert.length === 0) {
        setInfo("جميع الأيام المحددة مسجلة بالفعل كأيام إجازة.");
        setSaving(false);
        return;
      }

      const supabase = createClient();
      const payload = toInsert.map((date) => ({
        barber_id: barberId,
        date,
        start_time: null,
        end_time: null,
      }));

      const { error } = await supabase
        .from("time_off")
        // @ts-ignore - Supabase type inference issue with string literal table names
        .insert(payload);

      if (error) {
        // Unique violation can still happen on a race — treat as skip
        if (error.code === "23505") {
          setInfo("بعض الأيام كانت مسجلة بالفعل وتم تخطيها.");
        } else {
          throw error;
        }
      }

      const skipped = allDates.length - toInsert.length;
      if (skipped > 0) {
        setInfo(
          `تمت إضافة ${toInsert.length} يوم. تم تخطي ${skipped} مسجل بالفعل.`
        );
      } else {
        setInfo(`تمت إضافة ${toInsert.length} يوم.`);
      }

      setStartDate("");
      setEndDate("");
      await fetchTimeOff();
    } catch (err: any) {
      setError(err.message || "فشل في إضافة أيام الإجازة");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: TimeOffRow) {
    setEditingId(row.id);
    setEditingDate(row.date);
    setError(null);
    setInfo(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingDate("");
  }

  async function handleSaveEdit(id: string) {
    if (!editingDate) return;

    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("time_off")
        // @ts-ignore - Supabase type inference issue with string literal table names
        .update({ date: editingDate })
        .eq("id", id);

      if (error) {
        if (error.code === "23505") {
          throw new Error("يوجد يوم إجازة آخر مسجل في هذا التاريخ.");
        }
        throw error;
      }

      cancelEdit();
      await fetchTimeOff();
    } catch (err: any) {
      setError(err.message || "فشل في تحديث يوم الإجازة");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("إزالة يوم الإجازة هذا؟")) return;

    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("time_off").delete().eq("id", id);
      if (error) throw error;
      await fetchTimeOff();
    } catch (err: any) {
      setError(err.message || "فشل في حذف يوم الإجازة");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12" dir="rtl">
        <Loader2 className="animate-spin text-amber-500 mx-auto" size={32} />
      </div>
    );
  }

  const upcoming = rows.filter((r) => r.date >= today);
  const past = rows.filter((r) => r.date < today);

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-2xl font-bold mb-4">إدارة أيام الإجازة</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          حدد الأيام الكاملة التي تكون فيها غير متاح. اختر يومًا واحدًا أو نطاقًا.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="glass rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-end">
          <div>
            <label className="block text-sm font-medium mb-2">
              تاريخ البدء
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                // If end is before the new start, clear it
                if (endDate && endDate < e.target.value) setEndDate("");
              }}
              min={today}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              تاريخ الانتهاء <span className="text-gray-400">(اختياري)</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || today}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
            />
          </div>
          <Button type="submit" disabled={saving || !startDate}>
            <Plus size={16} className="ml-2" />
            إضافة يوم إجازة
          </Button>
        </div>
      </form>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {info && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm">
          {info}
        </div>
      )}

      {/* Upcoming */}
      <div>
        <h3 className="text-lg font-semibold mb-3">القادمة</h3>
        {upcoming.length === 0 ? (
          <div className="text-center py-8 glass rounded-xl">
            <CalendarOff className="mx-auto mb-3 text-gray-400" size={40} />
            <p className="text-gray-600 dark:text-gray-400">
              لا توجد أيام إجازة قادمة
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((row, index) => (
              <TimeOffRowItem
                key={row.id}
                row={row}
                index={index}
                editingId={editingId}
                editingDate={editingDate}
                setEditingDate={setEditingDate}
                saving={saving}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSaveEdit={handleSaveEdit}
                onDelete={handleDelete}
                minDate={today}
              />
            ))}
          </div>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-500">السابقة</h3>
          <div className="space-y-3 opacity-70">
            {past.map((row, index) => (
              <TimeOffRowItem
                key={row.id}
                row={row}
                index={index}
                editingId={editingId}
                editingDate={editingDate}
                setEditingDate={setEditingDate}
                saving={saving}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSaveEdit={handleSaveEdit}
                onDelete={handleDelete}
                minDate={undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface TimeOffRowItemProps {
  row: TimeOffRow;
  index: number;
  editingId: string | null;
  editingDate: string;
  setEditingDate: (v: string) => void;
  saving: boolean;
  onStartEdit: (row: TimeOffRow) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
  minDate: string | undefined;
}

function TimeOffRowItem({
  row,
  index,
  editingId,
  editingDate,
  setEditingDate,
  saving,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  minDate,
}: TimeOffRowItemProps) {
  const isEditing = editingId === row.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="glass rounded-xl p-4 flex items-center justify-between gap-4"
    >
      {isEditing ? (
        <input
          type="date"
          value={editingDate}
          min={minDate}
          onChange={(e) => setEditingDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
        />
      ) : (
        <div className="text-base font-medium">
          {format(parseISO(row.date), "EEEE، d MMMM yyyy", { locale: ar })}
        </div>
      )}

      <div className="flex gap-2">
        {isEditing ? (
          <>
            <Button
              size="sm"
              onClick={() => onSaveEdit(row.id)}
              disabled={saving}
            >
              <Save size={16} className="ml-1" />
              حفظ
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancelEdit}
              disabled={saving}
            >
              <X size={16} className="ml-1" />
              إلغاء
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStartEdit(row)}
              disabled={saving}
            >
              <Edit2 size={16} className="ml-1" />
              تعديل
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(row.id)}
              disabled={saving}
              className="border-red-500 text-red-500 hover:bg-red-500/10"
            >
              <Trash2 size={16} className="ml-1" />
              حذف
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}