/**
 * NextAuth v5 API route handler.
 * This is the standard catch-all route for NextAuth.
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
