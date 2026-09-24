import { NextResponse } from "next/server";

export async function POST() {
  // TODO: implement barber notification (email, SMS, push, etc.)
  // Requires the Supabase service-role key for auth.admin.getUserById().
  // For now, this is a no-op so the booking flow does not fail.
  return NextResponse.json({ ok: true });
}