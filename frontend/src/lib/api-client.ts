/**
 * API client for the DocuMind AI FastAPI backend.
 * Handles auth token injection, error handling, and typed responses.
 */

import type {
  AuthCallbackResponse,
  Conversation,
  Document,
  DocumentListResponse,
  UsageStats,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Store the FastAPI JWT in memory (not in cookies — separate from NextAuth session)
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Inject FastAPI JWT
  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(errorBody.detail || `API error: ${response.status}`);
  }

  // Handle empty responses
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ── Auth ────────────────────────────────────────────────────
export const authApi = {
  /**
   * Exchange NextAuth session for a FastAPI JWT.
   * Called after user authenticates via NextAuth OAuth.
   */
  async register(email: string, name?: string, avatarUrl?: string) {
    const data = await apiRequest<AuthCallbackResponse>("/auth/nextauth", {
      method: "POST",
      body: JSON.stringify({
        email,
        name: name || null,
        avatar_url: avatarUrl || null,
      }),
    });
    // Store the FastAPI JWT
    setAccessToken(data.access_token);
    return data;
  },

  async me() {
    return apiRequest<AuthCallbackResponse["user"]>("/auth/me");
  },

  async tenant() {
    return apiRequest<AuthCallbackResponse["tenant"]>("/auth/tenant");
  },
};

// ── Documents ───────────────────────────────────────────────
export const documentsApi = {
  async list(page = 1, pageSize = 20) {
    return apiRequest<DocumentListResponse>(
      `/documents?page=${page}&page_size=${pageSize}`
    );
  },

  async get(id: string) {
    return apiRequest<Document>(`/documents/${id}`);
  },

  async upload(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<Document>("/documents", {
      method: "POST",
      body: formData,
    });
  },

  async delete(id: string) {
    return apiRequest<void>(`/documents/${id}`, { method: "DELETE" });
  },
};

// ── Chat ────────────────────────────────────────────────────
export interface ChatStreamDoneEvent {
  id: string;
  conversation_id: string;
  sources: import("@/types").Source[];
  confidence_score: number;
  model_used: string;
  created_at: string;
}

export interface ChatStreamCallbacks {
  onDelta?: (text: string) => void;
  onDone?: (event: ChatStreamDoneEvent) => void;
  onError?: (detail: string) => void;
}

export const chatApi = {
  async conversations() {
    return apiRequest<{ conversations: Conversation[]; total: number }>(
      "/chat/conversations"
    );
  },

  async getMessages(conversationId: string) {
    return apiRequest<import("@/types").Message[]>(
      `/chat/conversations/${conversationId}/messages`
    );
  },

  async deleteConversation(id: string) {
    return apiRequest<void>(`/chat/conversations/${id}`, { method: "DELETE" });
  },

  /**
   * Send a chat message and stream the response over SSE.
   *
   * Uses `fetch` + a manual `ReadableStream` reader rather than the browser's
   * native `EventSource`, because `EventSource` cannot send the
   * `Authorization` header our JWT auth requires. Resolves with the
   * conversation id once the stream's `done` event arrives (or the request
   * fails), so callers can pass it back in as `conversation_id` for the next
   * message in the same thread.
   */
  async streamQuery(
    message: string,
    conversationId: string | null,
    callbacks: ChatStreamCallbacks
  ): Promise<void> {
    const token = getAccessToken();
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId || undefined,
      }),
    });

    if (!response.ok || !response.body) {
      const errorBody = await response.json().catch(() => ({ detail: "Unknown error" }));
      const detail = errorBody.detail || `API error: ${response.status}`;
      callbacks.onError?.(detail);
      throw new Error(detail);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line; each event has
      // `event: <name>` and `data: <json>` lines.
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? ""; // last chunk may be incomplete

      for (const rawEvent of events) {
        const lines = rawEvent.split("\n");
        const eventLine = lines.find((l) => l.startsWith("event:"));
        const dataLine = lines.find((l) => l.startsWith("data:"));
        if (!dataLine) continue;

        const eventName = eventLine?.slice("event:".length).trim() ?? "message";
        const data = dataLine.slice("data:".length).trim();

        try {
          const parsed = JSON.parse(data);
          if (eventName === "delta") {
            callbacks.onDelta?.(parsed.text);
          } else if (eventName === "done") {
            callbacks.onDone?.(parsed as ChatStreamDoneEvent);
          } else if (eventName === "error") {
            callbacks.onError?.(parsed.detail || "Unknown error");
          }
        } catch {
          // Ignore malformed SSE frames (e.g. keep-alive comments).
        }
      }
    }
  },
};

// ── Billing ─────────────────────────────────────────────────
export const billingApi = {
  async status() {
    return apiRequest<UsageStats>("/billing/status");
  },

  async plans() {
    return apiRequest<import("@/types").PlanInfo[]>("/billing/plans");
  },

  async upgrade(plan: string) {
    return apiRequest<{ status: string; plan: string }>("/billing/upgrade", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
  },
};

// ── Health ──────────────────────────────────────────────────
export const healthApi = {
  async check() {
    return apiRequest<{ status: string; version: string }>("/health");
  },
};
