# DocuMind AI — Multi-Tenant RAG SaaS

Teams upload documents and chat with their knowledge base, with source citations
on every answer. Multi-tenant, hybrid retrieval (vector + full-text), runs
entirely on free tiers.

See [PLAN.md](PLAN.md) for the full product/architecture spec, cost breakdown,
and phased build plan.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 + TypeScript + Tailwind, NextAuth v5 |
| Backend | FastAPI (Python 3.12), async SQLAlchemy 2.0 |
| Database | Postgres + pgvector (Neon free tier or local Docker) |
| Embeddings | Gemini `gemini-embedding-001` |
| LLM | Gemini 2.0 Flash (primary), Groq Llama 3.1 8B (fallback) |
| Storage | Cloudflare R2 (falls back to local disk) |

## Project Structure

```
Saas/
├── backend/          # FastAPI app — api/, core/, models/, schemas/, services/
│   ├── app/
│   ├── alembic/       # DB migrations
│   ├── tests/         # pytest suite
│   └── requirements.txt
├── frontend/          # Next.js 15 app
│   └── src/
├── docker-compose.yml # Local Postgres+pgvector+Redis
├── PLAN.md            # Full spec, cost model, build phases
└── tools/
    └── arch-analysis/ # Separate, unrelated tool — see its own README
```

> `tools/arch-analysis/` is a standalone Cloudflare Workers codebase-analysis
> tool that was previously mixed into this repo's root. It has no runtime
> dependency on DocuMind and can be deleted or split into its own repo without
> affecting the app.

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/python.exe -m pip install --no-cache-dir -r requirements.txt aiosqlite
cp .env.example .env   # fill in secrets — see below
docker compose -f ../docker-compose.yml up -d   # local Postgres + Redis
./.venv/Scripts/python.exe -m alembic upgrade head
./.venv/Scripts/python.exe run.py
```

API runs at `http://localhost:8000`, docs at `/docs` (dev only).

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in secrets — see below
npm run dev
```

Open `http://localhost:3000`.

### 3. Required secrets

| Var | Where | Notes |
|-----|-------|-------|
| `SECRET_KEY` | `backend/.env` | `openssl rand -hex 32` |
| `INTERNAL_AUTH_SECRET` | `backend/.env` **and** `frontend/.env.local` | Must be the **same value** in both. `openssl rand -hex 32`. Secures the NextAuth→FastAPI auth bridge — see [Security notes](#security-notes). |
| `DATABASE_URL` | `backend/.env` | Neon connection string, or local Docker default |
| `GEMINI_API_KEY` | `backend/.env` | [aistudio.google.com](https://aistudio.google.com/apikey) |
| `GROQ_API_KEY` | `backend/.env` | [console.groq.com](https://console.groq.com) |
| `AUTH_SECRET` | `frontend/.env.local` | `openssl rand -hex 32` — NextAuth session secret |
| `GOOGLE_CLIENT_ID` / `_SECRET` | `frontend/.env.local` | Optional; dev credentials login works without OAuth |
| `GITHUB_CLIENT_ID` / `_SECRET` | `frontend/.env.local` | Optional |

Full lists with descriptions are in [backend/.env.example](backend/.env.example)
and [frontend/.env.local.example](frontend/.env.local.example).

## Testing

```bash
cd backend
./.venv/Scripts/python.exe -m pytest -q     # 38 tests
```

```bash
cd frontend
npm test          # unit tests (Jest)
npm run test:e2e  # Playwright
```

## Security notes

- `/api/v1/auth/nextauth` mints a backend JWT for an email address. It is
  gated behind the `X-Internal-Secret` header (checked against
  `INTERNAL_AUTH_SECRET`) so only the trusted Next.js server — never the
  browser — can call it. The browser calls the same-origin
  `/api/auth/bridge` Next.js route instead, which reads the *verified*
  NextAuth session server-side and injects the secret.
- The backend refuses to boot with `ENVIRONMENT=production` if `SECRET_KEY`
  is left at its default, `INTERNAL_AUTH_SECRET` is unset, or `DEBUG=true`.
- Every tenant-scoped query is filtered by `tenant_id` at the application
  layer. There is no database-level RLS (despite earlier docs claiming
  otherwise) — treat the `WHERE tenant_id = ...` clauses as the only
  isolation boundary until RLS is added.

## License

MIT
