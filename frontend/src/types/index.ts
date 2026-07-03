/**
 * Shared TypeScript interfaces for the DocuMind AI frontend.
 */

// ── Auth ────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "admin" | "member";
  tenant_id: string;
  avatar_url: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro" | "enterprise";
}

export interface AuthCallbackResponse {
  access_token: string;
  token_type: string;
  user: User;
  tenant: Tenant;
}

// ── Documents ───────────────────────────────────────────────
export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export interface Document {
  id: string;
  tenant_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: DocumentStatus;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

// ── Chat ────────────────────────────────────────────────────
export type MessageRole = "user" | "assistant" | "system";

export interface Source {
  document_id: string;
  document_name: string;
  chunk_index: number;
  content: string;
  score: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  sources: Source[] | null;
  confidence_score: number | null;
  model_used: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// ── Billing ─────────────────────────────────────────────────
export interface PlanInfo {
  name: string;
  price: number;
  max_documents: number | null; // null = unlimited
  max_queries_per_day: number | null;
  features: string[];
}

export interface UsageStats {
  documents_used: number;
  queries_today: number;
  plan: string;
}

// ── API ─────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiError {
  detail: string;
}
