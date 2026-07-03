"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Loader2 } from "lucide-react";
import { documentsApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Document } from "@/types";

const ALLOWED_EXTENSIONS = ["pdf", "docx", "md", "markdown"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface DocumentUploadProps {
  onUploadComplete?: (document: Document) => void;
}

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        setError("Unsupported file type. Use PDF, DOCX, or Markdown.");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError("File too large. Maximum size is 10MB.");
        return;
      }

      setIsUploading(true);
      try {
        const document = await documentsApi.upload(file);
        onUploadComplete?.(document);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadComplete]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => handleFile(file));
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50"
        )}
      >
        {isUploading ? (
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        ) : (
          <Upload
            className={cn(
              "h-10 w-10",
              isDragging ? "text-primary" : "text-muted-foreground/50"
            )}
          />
        )}
        <h3 className="mt-3 text-sm font-medium">
          {isUploading
            ? "Uploading..."
            : isDragging
              ? "Drop files here"
              : "Drag and drop files here"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          or click to browse. Supports PDF, DOCX, and Markdown.
        </p>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        aria-label="file input"
        accept=".pdf,.docx,.md,.markdown"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
