import Link from "next/link";
import { Brain, FileSearch, MessageSquareQuote, Shield, Zap, BarChart3 } from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "Smart Document Parsing",
    description: "Upload PDFs, DOCX, and Markdown files. We extract, chunk, and embed every page.",
  },
  {
    icon: MessageSquareQuote,
    title: "AI Chat with Citations",
    description: "Ask questions and get answers with inline source citations you can verify.",
  },
  {
    icon: Zap,
    title: "Hybrid Search",
    description: "Vector similarity + full-text search with reciprocal rank fusion for best results.",
  },
  {
    icon: Shield,
    title: "Multi-Tenant Isolation",
    description: "Row-level security ensures your data stays private and isolated per workspace.",
  },
  {
    icon: BarChart3,
    title: "Usage Analytics",
    description: "Track queries, documents, and AI usage across your team in real time.",
  },
  {
    icon: Brain,
    title: "Dual LLM Fallback",
    description: "Gemini 2.0 Flash primary with Groq Llama 3.1 fallback for maximum reliability.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">DocuMind AI</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm">
            <Zap className="h-4 w-4 text-primary" />
            <span>Powered by Gemini + Groq AI</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Chat with your
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {" "}documents
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Upload your knowledge base and get instant AI-powered answers with
            source citations. Built for teams who want to query their own data.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
            >
              Start for Free
            </Link>
            <Link
              href="#features"
              className="rounded-lg border border-border px-8 py-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              See Features
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            No credit card required. Free tier includes 5 documents and 20 queries/day.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-card/50 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything you need for document AI
            </h2>
            <p className="mt-3 text-muted-foreground">
              A complete RAG pipeline from upload to answer, built with modern
              open-source tools.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to chat with your docs?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Get started in minutes. Upload a PDF and ask your first question today.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Brain className="h-4 w-4" />
            <span>DocuMind AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built with Next.js, FastAPI, Neon & Gemini
          </p>
        </div>
      </footer>
    </div>
  );
}
