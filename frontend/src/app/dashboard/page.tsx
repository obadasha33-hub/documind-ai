"use client";

import { useSession } from "next-auth/react";
import { FileText, MessageSquare, Zap, TrendingUp } from "lucide-react";
import Link from "next/link";

const stats = [
  { label: "Documents", value: "0", icon: FileText, href: "/dashboard/documents" },
  { label: "Conversations", value: "0", icon: MessageSquare, href: "/dashboard/chat" },
  { label: "Queries Today", value: "0", icon: Zap, href: "/dashboard/billing" },
  { label: "Plan", value: "Free", icon: TrendingUp, href: "/dashboard/billing" },
];

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s an overview of your DocuMind AI workspace.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
              <stat.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
            </div>
            <p className="mt-2 text-3xl font-bold">{stat.value}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Get Started</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload your first document to start chatting with AI.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard/documents"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Upload Document
            </Link>
            <Link
              href="/dashboard/chat"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Start Chat
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">How It Works</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                1
              </span>
              Upload PDF, DOCX, or Markdown files
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                2
              </span>
              Documents are parsed, chunked, and embedded
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                3
              </span>
              Ask questions and get AI answers with citations
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
