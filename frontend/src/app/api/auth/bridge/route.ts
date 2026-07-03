/**
 * Server-side NextAuth → FastAPI bridge.
 *
 * Runs on the Next.js server (never the browser), so it can safely hold the
 * INTERNAL_AUTH_SECRET. It derives the user's email from the *verified* NextAuth
 * session — not from client-supplied input — then exchanges it for a FastAPI
 * JWT. This closes the auth-bypass: the backend only mints tokens for callers
 * that present the shared secret, which only this server knows.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Prefer a server-only API URL; fall back to the public one for local dev.
const API_BASE =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api/v1";

export async function POST() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const secret = process.env.INTERNAL_AUTH_SECRET;

  const res = await fetch(`${API_BASE}/auth/nextauth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-Internal-Secret": secret } : {}),
    },
    body: JSON.stringify({
      email: session.user.email,
      name: session.user.name ?? null,
      avatar_url: session.user.image ?? null,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "Auth bridge failed", detail },
      { status: 502 }
    );
  }

  return NextResponse.json(await res.json());
}
