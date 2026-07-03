# DocuMind AI - Multi-Tenant RAG SaaS Platform ($0/mo)

## Context

Building a portfolio-worthy AI SaaS application — a multi-tenant RAG platform where teams upload documents and query their knowledge base via chat with source citations. **The entire stack runs at $0/month** using only free tiers and open-source tools. Workspace: `c:\Users\LENOVO\Documents\Saas`.

## Tech Stack (100% Free)

| Layer | Technology | Cost | Notes |
|-------|-----------|------|-------|
| Frontend | Next.js 15 + TypeScript + Tailwind | **Free** | Vercel Hobby tier |
| Auth | NextAuth.js v5 (Google + GitHub OAuth + email) | **Free** | No paid auth provider |
| Backend | FastAPI (Python 3.12) on Render.com | **Free** | 750 hrs/mo, 512MB RAM, sleeps after 15min |
| Backend (alt) | Docker + Oracle Cloud Always Free | **Free** | 2 ARM OCPUs, 12GB RAM, always on |
| Database | Neon Postgres + pgvector (768-dim) | **Free** | 0.5GB storage, 190 compute hrs/mo |
| Embeddings | Gemini `gemini-embedding-001` | **Free** | 3072 dims truncated to 768 |
| LLM (primary) | Gemini 2.0 Flash | **Free** | 15 RPM, 1M tokens/min |
| LLM (fallback) | Groq Llama 3.1 8B | **Free** | 30 RPM, fast inference |
| Task Queue | ARQ via Upstash Redis | **Free** | 500K commands/mo |
| Storage | Cloudflare R2 | **Free** | 10GB, 10M reads/mo |
| Billing | Demo mode (Stripe-ready) | **Free** | Mock checkout, add Stripe key to activate |
| Email | Resend | **Free** | 100 emails/day |
| Domain | .onrender.com + .vercel.app | **Free** | Free subdomains |

## Monthly Operational Costs: $0/mo

| Phase | Users | Monthly Cost | Notes |
|-------|-------|-------------|-------|
| Development | 0 | **$0/mo** | Local Docker + free APIs |
| Portfolio/Demo | 1-50 | **$0/mo** | Render.com + Vercel free tiers |
| Launch | 100 | **$0/mo** | Free tiers handle moderate traffic |
| Growth | 1,000+ | **~$7/mo** | Only if you outgrow free tiers (optional upgrade) |

### Free Tier Limits to Be Aware Of
- **Render.com**: 512MB RAM, sleeps after 15min inactivity (30-60s cold start). Fine for demos.
- **Neon**: 190 compute hrs/mo (auto-suspends after 5min idle). Branching available.
- **Gemini**: 15 requests/min. Implement exponential backoff retry.
- **Groq**: 30 requests/min on free tier. Use as fallback only.
- **Cloudflare R2**: 10GB storage, 10M Class A reads/mo.

### When You'd Actually Need to Pay
- 1,000+ active daily users hitting rate limits
- Large document corpus exceeding Neon's 0.5GB storage
- Production SLA requirements (no cold starts)
- Custom domain (~$12/year optional)

## Development Timeline: 10-12 Weeks (~20 hrs/week)

| Week | Phase | Milestone |
|------|-------|-----------|
| 1 | Scaffolding + DB models | Docker Compose, Neon setup, Alembic migration live |
| 2 | Auth (NextAuth + FastAPI JWT) | Sign up, login, protected routes working |
| 3 | Document parsing + chunking + embedding | PDF parsed, chunked, embedded via Gemini API |
| 4 | Async pipeline + upload UI | Upload PDF -> async process -> status "Ready" |
| 5 | Hybrid search + LLM clients | Vector + full-text search returning ranked results |
| 6 | Streaming chat + source attribution | Full RAG chat with cited streaming responses |
| 7 | Multi-tenant + billing demo | Workspace management, plan upgrades, usage limits |
| 8 | Rate limiting + hallucination guardrails | Guardrails flag unsupported claims |
| 9 | Admin dashboard + UX polish | Usage charts, error handling, onboarding |
| 10 | Deploy to Vercel + Render.com | Live at free subdomains, e2e tests passing |
| 11-12 | Buffer + testing + docs | Portfolio-ready MVP |

## Required Accounts & API Keys (All Free)

| Service | URL | Key Needed | Cost |
|---------|-----|------------|------|
| Google AI Studio | aistudio.google.com | `GEMINI_API_KEY` | **Free** |
| Groq Cloud | console.groq.com | `GROQ_API_KEY` | **Free** |
| Neon | neon.tech | `DATABASE_URL` | **Free** |
| Upstash | upstash.com | `UPSTASH_REDIS_URL` + token | **Free** |
| Cloudflare | dash.cloudflare.com | R2 keys | **Free** |
| Render.com | render.com | Deploy from GitHub | **Free** |
| Vercel | vercel.com | Deploy from GitHub | **Free** |
| Google OAuth | console.cloud.google.com | Client ID + Secret | **Free** |
| GitHub OAuth | github.com/settings/developers | Client ID + Secret | **Free** |
| Resend | resend.com | `RESEND_API_KEY` | **Free** |

> **No credit card required for any service.** OpenAI removed — Gemini + Groq cover all LLM needs on free tiers.

## Project Structure

```
documind-ai/
├── frontend/                    # Next.js 15 (Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx       # Root layout + providers
│   │   │   ├── page.tsx         # Landing page
│   │   │   ├── (auth)/          # Login, register
│   │   │   ├── (dashboard)/     # Dashboard, documents, chat, billing, admin
│   │   │   └── api/auth/        # NextAuth route
│   │   ├── components/
│   │   │   ├── ui/              # Button, Input, Card, Dialog, Badge, etc.
│   │   │   ├── layout/         # Sidebar, header
│   │   │   ├── documents/      # Upload zone, document list
│   │   │   ├── chat/           # Messages, input, source panel, confidence badge
│   │   │   └── billing/        # Plan cards, usage meter
│   │   ├── lib/                 # api-client, auth config, utils
│   │   ├── types/               # TypeScript interfaces
│   │   └── hooks/               # React Query hooks
│   └── package.json
├── backend/                     # FastAPI (Render.com free tier)
│   ├── app/
│   │   ├── main.py              # App factory, CORS, lifespan
│   │   ├── core/                # config, security, database, deps, exceptions
│   │   ├── models/              # SQLAlchemy ORM (tenant, user, document, chunk, embedding, conversation, usage)
│   │   ├── schemas/             # Pydantic request/response models
│   │   ├── api/                 # Route handlers (auth, tenants, documents, chat, billing, usage, health)
│   │   ├── services/            # Business logic (storage, parsers, chunking, embeddings, retrieval, llm, prompts, generation, billing, usage)
│   │   └── workers/             # ARQ task queue (settings, tasks)
│   ├── alembic/                 # DB migrations
│   ├── tests/                   # pytest test suite
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml           # Local Postgres+pgvector+Redis
└── .env.example
```

## Implementation Plan

### Task 1: Project Scaffolding (Phase 0, ~6 hrs)
- Initialize Next.js 15 with TypeScript, Tailwind, App Router in `frontend/`
- Create FastAPI project structure in `backend/` with `requirements.txt`
- Create `docker-compose.yml` with Postgres+pgvector+Redis for local dev
- Create `.env.example` with all required environment variables
- Set up `.gitignore`, initialize git repo

### Task 2: Database Layer + Auth (Phase 1, ~14 hrs)
- **Backend**: SQLAlchemy models for all tables (tenants, users, documents, chunks, embeddings, conversations, messages, usage_records)
- **Backend**: Alembic initial migration with pgvector extension, HNSW indexes, RLS policies
- **Backend**: Core config (`pydantic-settings`), async database session factory with tenant context
- **Backend**: JWT validation, auth middleware that extracts user/tenant from token
- **Backend**: Auth API endpoints (verify token, get current user)
- **Frontend**: NextAuth v5 config with Google + GitHub OAuth + email magic link
- **Frontend**: Login/register pages with OAuth buttons
- **Frontend**: Dashboard layout with sidebar (protected routes)

### Task 3: Document Ingestion Pipeline (Phase 2, ~18 hrs)
- **Backend**: Cloudflare R2 storage service (boto3 with S3-compatible endpoint)
- **Backend**: Document parsers — PDF (PyMuPDF), DOCX (python-docx), Markdown
- **Backend**: Chunking service (RecursiveCharacterTextSplitter, 512 tokens, 64 overlap)
- **Backend**: Embedding service (Gemini `gemini-embedding-001`, truncate to 768 dims, batch support)
- **Backend**: ARQ worker setup with `process_document` task (upload -> parse -> chunk -> embed -> index)
- **Backend**: Document CRUD API (upload, list, get status, delete)
- **Frontend**: Document upload page with drag-and-drop
- **Frontend**: Document list with status badges (pending/processing/ready/failed)

### Task 4: RAG Retrieval + Chat (Phase 3, ~20 hrs)
- **Backend**: Hybrid search service — vector similarity (pgvector cosine) + full-text search (tsvector + ts_rank) + reciprocal rank fusion
- **Backend**: Gemini 2.0 Flash client (async httpx, streaming SSE support)
- **Backend**: Groq Llama client (fallback on Gemini failures/rate limits)
- **Backend**: Prompt engineering — system prompt with citation format + hallucination guardrails
- **Backend**: RAG generation service — orchestrates retrieval + context assembly + LLM call
- **Backend**: Streaming chat API endpoint (SSE) — embed query -> search -> stream response -> save history
- **Backend**: Source attribution — parse citation markers, map to chunks/documents
- **Frontend**: Chat page with streaming messages (markdown rendered)
- **Frontend**: Source citation panel (document name, page, snippet, confidence)
- **Frontend**: Confidence badge (green/yellow/red based on retrieval scores)

### Task 5: Multi-Tenant + Billing Demo (Phase 4, ~14 hrs)
- **Backend**: Tenant/workspace management API (create, invite members, roles)
- **Backend**: Plan enforcement middleware (check limits: docs, queries, storage)
- **Backend**: Demo billing service — mock Stripe checkout flow, plan state management (Free/Pro/Enterprise)
- **Backend**: Usage tracking service (record queries, uploads, tokens per tenant)
- **Backend**: Stripe-ready architecture — swap in real Stripe keys when ready to monetize
- **Frontend**: Workspace settings page (team members, roles)
- **Frontend**: Billing page — plan comparison (Free/Pro $19/Enterprise $49), demo upgrade flow, usage meters

### Task 6: Guardrails + Admin + Polish (Phase 5, ~12 hrs)
- **Backend**: Rate limiting via Upstash Redis sliding window (Free: 20 queries/day, Pro: 500/day)
- **Backend**: Hallucination guardrails — verify citations exist in source chunks
- **Backend**: Conversation management (list, rename, delete, search)
- **Frontend**: Admin dashboard with usage charts (Recharts)
- **Frontend**: Error boundaries, loading skeletons, toast notifications, onboarding flow

### Task 7: Deployment + Production (Phase 6, ~10 hrs)
- Deploy frontend to **Vercel** (free Hobby tier, `.vercel.app` subdomain)
- Deploy backend to **Render.com** (free tier, `.onrender.com` subdomain, Dockerfile)
- Run production Alembic migrations on Neon
- Configure CORS for production domains
- End-to-end testing: signup -> upload -> query -> demo billing upgrade
- **Optional**: Add Stripe keys + custom domain ($12/yr) when ready to monetize

## Key Backend Dependencies (`requirements.txt`)

```
fastapi>=0.115
uvicorn[standard]>=0.30
sqlalchemy[asyncio]>=2.0
asyncpg>=0.30
alembic>=1.13
pgvector>=0.3
pydantic>=2.9
pydantic-settings>=2.5
python-jose[cryptography]>=3.3
passlib[bcrypt]>=1.7
httpx>=0.27
pymupdf>=1.24
python-docx>=1.1
langchain-text-splitters>=0.3
arq>=0.26
redis[hiredis]>=5.0
boto3>=1.35
# stripe>=10.0  # Uncomment when activating real payments
sse-starlette>=2.0
slowapi>=0.1
resend>=2.0
structlog>=24.0
python-multipart>=0.0.9
```

## Key Frontend Dependencies (`package.json`)

```
next@^15, typescript@^5, tailwindcss@^4
next-auth@^5 (beta), @radix-ui/react-*, lucide-react
react-hook-form@^7, zod@^3, @hookform/resolvers
@tanstack/react-query@^5, ai@^4 (Vercel AI SDK)
recharts@^2, react-markdown@^9, sonner, date-fns@^4
```

## Database Schema (Key Tables)

- **tenants**: id, name, slug, stripe_customer_id, plan (free/pro/enterprise)
- **users**: id, tenant_id, email, name, role (owner/admin/member)
- **documents**: id, tenant_id, filename, file_type, r2_key, status, chunk_count
- **chunks**: id, document_id, tenant_id, content, metadata (JSONB), chunk_index
- **embeddings**: id, chunk_id, tenant_id, embedding (vector(768)), model
- **conversations**: id, tenant_id, user_id, title
- **messages**: id, conversation_id, role, content, sources (JSONB), confidence_score, model_used, latency_ms
- **usage_records**: id, tenant_id, event_type, quantity

All tenant-scoped tables have RLS policies enforcing data isolation via `tenant_id`.

## Verification Strategy

After each phase, verify:
1. **Phase 1**: Register/login works, DB has tenant+user rows, RLS blocks cross-tenant access
2. **Phase 2**: Upload a 10-page PDF -> status "Ready" in ~30s -> ~20-40 chunks with 768-dim embeddings in DB
3. **Phase 3**: Ask a question about the uploaded PDF -> get streaming response with at least 1 source citation
4. **Phase 4**: View billing page -> click upgrade -> demo checkout confirms -> plan updates to "Pro"
5. **Phase 6**: All above works on production deployment at custom domain

## Known Limitations (MVP Scope)

- No OCR for scanned/image-only PDFs (future enhancement)
- Only PDF, DOCX, Markdown supported (no PPTX, XLSX, HTML)
- No real-time collaboration between users
- Single-region deployment
- Embedding model switch requires re-embedding all chunks
- Render.com free tier: 30-60s cold start after 15min inactivity
- Neon free tier: auto-suspends after 5min idle (first query takes ~2s)
- Billing is demo mode (Stripe-ready architecture, add keys to activate)

## Free-to-Paid Upgrade Path (When Ready)

| Trigger | Upgrade | Cost |
|---------|---------|------|
| Custom domain needed | Buy domain (Namecheap/Cloudflare) | ~$12/year |
| Cold starts unacceptable | Move backend to Railway or Fly.io paid | ~$7/mo |
| Outgrow Neon storage | Upgrade Neon or move to Supabase | ~$19/mo |
| Ready to charge users | Activate Stripe with real keys | 2.9% + 30c/txn (from revenue) |
| Need OpenAI models | Add OpenAI API key | Pay-as-you-go |
