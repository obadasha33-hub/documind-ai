"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Trash2,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  File,
} from "lucide-react";
import { toast } from "sonner";
import { documentsApi } from "@/lib/api-client";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { formatFileSize, formatRelativeTime, cn } from "@/lib/utils";
import type { Document, DocumentStatus } from "@/types";

const statusConfig: Record<
  DocumentStatus,
  { label: string; icon: typeof CheckCircle2; color: string }
> = {
  pending: { label: "Pending", icon: Clock, color: "text-muted-foreground" },
  processing: { label: "Processing", icon: Loader2, color: "text-yellow-500" },
  ready: { label: "Ready", icon: CheckCircle2, color: "text-green-500" },
  failed: { label: "Failed", icon: XCircle, color: "text-destructive" },
};

function StatusBadge({ status }: { status: DocumentStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <div className={cn("flex items-center gap-1.5 text-xs font-medium", config.color)}>
      <Icon className={cn("h-3.5 w-3.5", status === "processing" && "animate-spin")} />
      {config.label}
    </div>
  );
}

function FileTypeIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    pdf: "text-red-500 bg-red-500/10",
    docx: "text-blue-500 bg-blue-500/10",
    md: "text-purple-500 bg-purple-500/10",
  };
  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg",
        colors[type] || "text-muted-foreground bg-muted"
      )}
    >
      {type === "pdf" ? (
        <FileText className="h-5 w-5" />
      ) : (
        <File className="h-5 w-5" />
      )}
    </div>
  );
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();

  // Fetch documents
  const { data, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.list(1, 50),
    refetchInterval: 5000, // Poll every 5s for status updates
  });

  const handleUploadComplete = () => {
    toast.success("Document uploaded! Processing will begin shortly.");
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      toast.success("Document deleted.");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  const documents = data?.documents || [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="mt-1 text-muted-foreground">
          Upload and manage your knowledge base.
        </p>
      </div>

      <DocumentUpload onUploadComplete={handleUploadComplete} />

      {/* Document list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border py-16">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No documents yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a PDF, DOCX, or Markdown file to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc: Document) => (
            <div
              key={doc.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <FileTypeIcon type={doc.file_type} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{doc.filename}</p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatFileSize(doc.file_size)}</span>
                  <span>{doc.chunk_count} chunks</span>
                  <span>{formatRelativeTime(doc.created_at)}</span>
                </div>
              </div>
              <StatusBadge status={doc.status} />
              <button
                onClick={() => {
                  if (confirm(`Delete "${doc.filename}"?`)) {
                    deleteMutation.mutate(doc.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
