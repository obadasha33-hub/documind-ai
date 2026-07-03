"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { chatApi } from "@/lib/api-client";
import { cn, formatRelativeTime } from "@/lib/utils";
import { ChatInterface } from "@/components/chat/ChatInterface";

export default function ChatPage() {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => chatApi.conversations(),
  });
  const conversations = data?.conversations ?? [];

  const handleConversationCreated = (conversationId: string) => {
    setActiveConversationId(conversationId);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await chatApi.deleteConversation(id);
      if (activeConversationId === id) setActiveConversationId(null);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete conversation");
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-6xl gap-4">
      {/* Conversation list */}
      <aside className="flex w-64 shrink-0 flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h2 className="text-sm font-semibold">Conversations</h2>
          <button
            onClick={() => setActiveConversationId(null)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              No conversations yet. Send a message to start one.
            </p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveConversationId(c.id)}
                className={cn(
                  "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  activeConversationId === c.id ? "bg-accent" : "hover:bg-accent/50"
                )}
              >
                <span className="truncate">{c.title}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground group-hover:hidden">
                    {formatRelativeTime(c.updated_at)}
                  </span>
                  <Trash2
                    className="hidden h-3.5 w-3.5 text-muted-foreground hover:text-destructive group-hover:block"
                    onClick={(e) => handleDelete(c.id, e)}
                  />
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Chat panel */}
      <div className="flex flex-1 flex-col rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h1 className="text-lg font-semibold">
            {activeConversationId
              ? conversations.find((c) => c.id === activeConversationId)?.title ?? "Chat"
              : "New conversation"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ask questions about your documents and get AI-powered answers with source citations.
          </p>
        </div>

        {activeConversationId === null && conversations.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Start a conversation</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload documents first, then ask a question below.
            </p>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <ChatInterface
            sessionId={activeConversationId}
            onConversationCreated={handleConversationCreated}
          />
        </div>
      </div>
    </div>
  );
}
