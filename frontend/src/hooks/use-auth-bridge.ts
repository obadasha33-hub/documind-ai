"use client";

import { useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { setAccessToken, getAccessToken } from "@/lib/api-client";
import type { User, Tenant } from "@/types";

/**
 * Hook that bridges NextAuth session → FastAPI JWT.
 *
 * Calls the same-origin server route `/api/auth/bridge`, which holds the
 * INTERNAL_AUTH_SECRET and talks to the backend on our behalf. The browser
 * never sees the secret and cannot request a token for an arbitrary email.
 */
export function useAuthBridge() {
  const { data: session, status } = useSession();

  const bridge = useCallback(async () => {
    if (status !== "authenticated" || !session?.user?.email) return;

    // Skip if we already have a token
    if (getAccessToken()) return;

    try {
      const res = await fetch("/api/auth/bridge", { method: "POST" });
      if (!res.ok) {
        throw new Error(`Bridge responded ${res.status}`);
      }
      const data = await res.json();
      setAccessToken(data.access_token);
    } catch (err) {
      console.error("Auth bridge failed:", err);
    }
  }, [session, status]);

  useEffect(() => {
    bridge();
  }, [bridge]);

  return { status };
}

export interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  isLoading: boolean;
}
