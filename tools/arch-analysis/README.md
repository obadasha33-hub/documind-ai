# Architecture Analysis Platform

> This tool was previously mixed into the root of the DocuMind AI repo. It is
> unrelated to that product — a zero-cost, cloud-native codebase analysis tool
> that runs entirely on Cloudflare's free tier. It can be split into its own
> repo without affecting DocuMind. All commands below are run from this
> directory (`tools/arch-analysis/`).

Analyze any codebase for architecture documentation, inconsistencies, and
actionable recommendations.

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Cloudflare    │     │  Cloudflare      │     │  Cloudflare     │
│   Pages (React) │────▶│  Workers (Hono)  │────▶│  Queues         │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                    ┌──────────────────┐                  ▼
                    │  Cloudflare D1   │           ┌─────────────────┐
                    │  (SQLite)        │◀─────────▶│  Workers        │
                    └──────────────────┘           │  (Analysis)     │
                    ┌──────────────────┐           └─────────────────┘
                    │  Cloudflare R2   │
                    │  (Assets)        │
                    └──────────────────┘
```

## 🚀 Features

- **Architecture Documentation** - Auto-generate `architecture.md` with Mermaid diagrams
- **Inconsistency Detection** - Circular deps, duplication, naming conflicts, dead code
- **Actionable Recommendations** - Prioritized fixes with effort/impact scores
- **Security Scanning** - CVE detection via OSV.dev, deprecated library alerts
- **Multi-language Support** - Python, JS/TS, Java, C#, Go, Rust via tree-sitter WASM
- **Real-time Progress** - WebSocket/SSE updates during analysis
- **Interactive Diagrams** - Zoom, pan, export Mermaid/PNG diagrams

## 💰 Cost: $0/month

| Service | Free Tier | Usage |
|---------|-----------|-------|
| Cloudflare Workers | 100k req/day | API + Analysis |
| Cloudflare Pages | 500 builds/mo | Frontend |
| Cloudflare D1 | 5M reads/day, 1GB | Database |
| Cloudflare R2 | 10GB/mo, 1M ops | Repo uploads, diagrams |
| Cloudflare Queues | 1M ops/mo | Async jobs |
| Cloudflare KV | 100k reads/day, 1GB | Caching |
| GitHub Actions | 2000 min/mo | CI/CD |

## 📋 Prerequisites

- Node.js 20+
- npm 10+ / pnpm / yarn
- Cloudflare account (free)
- GitHub account (free)

## 🛠️ Quick Start

### 1. Install (from this directory)

```bash
cd tools/arch-analysis
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Provision Cloudflare Resources

```bash
wrangler login

wrangler d1 create arch-analysis-db
wrangler r2 bucket create arch-analysis-assets
wrangler queues create arch-analysis-jobs
wrangler kv namespace create CACHE

# Copy the IDs from output into wrangler.toml
```

### 4. Run Database Migrations

```bash
wrangler d1 execute arch-analysis-db --file=./packages/db/schema.sql --remote
```

### 5. Start Development

```bash
npm run dev:api
npm run dev:web
```

Open http://localhost:3000

## 📦 Project Structure

```
tools/arch-analysis/
├── apps/
│   ├── api/                 # Cloudflare Workers (Hono)
│   └── web/                 # Cloudflare Pages (React + Vite)
├── packages/
│   ├── core/                # Shared analysis engine
│   ├── db/                  # D1 database client
│   └── ui/                  # Shared React components
├── .github/workflows/       # CI/CD (if split into its own repo)
├── package.json
├── tsconfig.json
├── wrangler.toml
└── .env.example
```

## 🔧 Available Scripts

```bash
npm run dev:api      # Start API dev server (wrangler dev)
npm run dev:web      # Start web dev server (vite)
npm run build        # Build all packages
npm run lint         # ESLint all packages
npm run typecheck    # TypeScript check all packages
npm run test         # Run tests (vitest)
npm run db:migrate   # Apply migrations to remote D1
npm run deploy       # Deploy to Cloudflare (via GitHub Actions)
```

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/projects` | Create project + upload repo |
| GET | `/api/projects` | List user projects |
| GET | `/api/projects/:id` | Get project status |
| GET | `/api/projects/:id/report` | Architecture markdown |
| GET | `/api/projects/:id/diagrams` | Mermaid + PNG URLs |
| GET | `/api/projects/:id/issues` | Paginated issues |
| GET | `/api/projects/:id/issues/summary` | Severity counts |
| GET | `/api/projects/:id/recommendations` | Prioritized recs |
| GET | `/api/auth/me` | Current user |

## 🔍 Analysis Pipeline

1. **Scanner** - Discovers files, detects languages
2. **Parsers** - tree-sitter WASM parses each file
3. **Graph Builder** - Constructs dependency graph
4. **Detectors** - Runs inconsistency checks in parallel
5. **Generators** - Creates Mermaid diagrams, markdown reports
6. **Recommenders** - Produces prioritized recommendations
7. **Storage** - Saves to D1 + diagrams to R2

## 🔐 Environment Variables

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Workers/Pages deploy token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `GH_PAT` | GitHub PAT for Advisory DB |
| `GEMINI_API_KEY` | Google Gemini for AI recommendations (optional) |

> **The `.env` in this folder was found to contain live credentials in
> plaintext.** Rotate the Cloudflare API token and GitHub PAT if this repo
> or environment has ever been shared, and keep `.env` out of git (already
> covered by the root `.gitignore`).

## 🙏 Acknowledgments

- [tree-sitter](https://tree-sitter.github.io/) - Multi-language parsing
- [Cloudflare](https://cloudflare.com/) - Free tier infrastructure
- [OSV.dev](https://osv.dev/) - Vulnerability database
- [Hono](https://hono.dev/) - Web framework
- [Mermaid](https://mermaid.js.org/) - Diagram generation
