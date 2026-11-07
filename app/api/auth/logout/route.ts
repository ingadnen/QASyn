import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

/** POST /api/auth/logout */
export async function POST() {
  await destroySession();
  return NextResponse.json({ next: "/login" });
}
