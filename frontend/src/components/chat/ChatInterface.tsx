"use client";

import { useState, useRef, useCallback, useEffect, FormEvent } from "react";
import { Send, Loader2, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { chatApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Message, Source } from "@/types";

interface ChatInterfaceProps {
  sessionId: string | null;
  onConversationCreated?: (conversationId: string) => void;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[] | null;
  confidenceScore?: number | null;
  streaming?: boolean;
}

function ConfidenceBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const tier =
    score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low";
  const styles = {
    high: "bg-green-500/10 text-green-600 dark:text-green-400",
    medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    low: "bg-red-500/10 text-red-600 dark:text-red-400",
  } as const;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        styles[tier]
      )}
    >
      {Math.round(score * 100)}% confidence
    </span>
  );
}

function SourcesPanel({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-2 space-y-1.5" aria-label="citations">
      <p className="text-xs font-medium text-muted-foreground">Sources</p>
      {sources.map((s, i) => (
        <div
          key={`${s.document_id}-${i}`}
          className="rounded-lg border border-border bg-muted/40 p-2 text-xs"
        >
          <div className="flex items-center gap-1.5 font-medium">
            <FileText className="h-3 w-3" />
            {s.document_name}
          </div>
          <p className="mt-1 line-clamp-2 text-muted-foreground">{s.content}</p>
        </div>
      ))}
    </div>
  );
}

export function ChatInterface({ sessionId, onConversationCreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    chatApi
      .getMessages(sessionId)
      .then((history) => {
        if (cancelled) return;
        setMessages(
          history.map((m: Message) => ({
            id: m.id,
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
            sources: m.sources,
            confidenceScore: m.confidence_score,
          }))
        );
      })
      .catch((err: Error) => setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isSending) return;

      setInput("");
      setIsSending(true);

      const userMsg: DisplayMessage = {
        id: `pending-user-${Date.now()}`,
        role: "user",
        content: text,
      };
      const assistantMsgId = `pending-assistant-${Date.now()}`;
      const assistantMsg: DisplayMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        streaming: true,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      try {
        await chatApi.streamQuery(text, sessionId, {
          onDelta: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + delta } : m
              )
            );
          },
          onDone: (done) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      id: done.id,
                      sources: done.sources,
                      confidenceScore: done.confidence_score,
                      streaming: false,
                    }
                  : m
              )
            );
            if (!sessionId) {
              // First message in a new conversation — let the parent know the
              // conversation id the backend created, so future messages in
              // this thread pass it back as `conversation_id`.
              onConversationCreated?.(done.conversation_id);
            }
          },
          onError: (detail) => {
            toast.error(`Error sending message: ${detail}`);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: detail, streaming: false }
                  : m
              )
            );
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        toast.error(`Error sending message: ${message}`);
      } finally {
        setIsSending(false);
      }
    },
    [input, isSending, sessionId, onConversationCreated]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {loadError && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {loadError}
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            data-role={m.role}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {m.content || (m.streaming && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ))}
              {m.role === "assistant" && !m.streaming && (
                <>
                  {m.confidenceScore != null && (
                    <div className="mt-2">
                      <ConfidenceBadge score={m.confidenceScore} />
                    </div>
                  )}
                  {m.sources && <SourcesPanel sources={m.sources} />}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        role="form"
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border p-4"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isSending}
          className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          aria-label={isSending ? "Sending" : "Send"}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );
}
