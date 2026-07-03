---

description: "Task list for Project Architecture Analysis - Cloudflare Workers Web App"

---

# Tasks: Project Architecture Analysis (Cloudflare Workers Web App)

**Input**: Design documents from `/specs/001-project-architecture-spec/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Architecture**: Cloudflare Workers (API) + Pages (Frontend) + D1 (DB) + R2 (Storage) + Queues (Async Jobs)

**Tests**: OPTIONAL - Only include if explicitly requested in feature specification

**Organization**: Tasks grouped by user story to enable independent implementation and testing

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `apps/api/` (Workers), `apps/web/` (Pages/React), `packages/` (shared)
- **Shared packages**: `packages/core/` (analyzers, models), `packages/db/` (D1 schema), `packages/ui/` (components)

---

## Phase 0: Cloud Infrastructure Setup (Shared Infrastructure)

**Purpose**: Provision and configure all Cloudflare resources via code

- [ ] T001 Create Cloudflare account and authenticate `wrangler` CLI
- [ ] T002 Create D1 database `arch-analysis-db` via `wrangler d1 create`
- [ ] T003 Create R2 bucket `arch-analysis-assets` via `wrangler r2 bucket create`
- [ ] T004 Create Queue `arch-analysis-jobs` via `wrangler queues create`
- [ ] T005 [P] Configure `wrangler.toml` for API (Workers) with D1, R2, Queue bindings
- [ ] T006 [P] Configure `wrangler.toml` for Web (Pages) with build output directory
- [ ] T007 [P] Set up GitHub repository with Cloudflare Pages project connected
- [ ] T008 [P] Configure custom domain (optional) via Cloudflare DNS
- [ ] T009 [P] Create GitHub Actions workflow `.github/workflows/deploy.yml` for auto-deploy on push

---

## Phase 1: Monorepo Setup & Shared Core

**Purpose**: Project initialization, shared packages, core analysis engine

- [ ] T010 Create monorepo structure: `apps/api`, `apps/web`, `packages/core`, `packages/db`, `packages/ui`
- [ ] T011 Initialize `package.json` workspaces with npm/yarn/pnpm
- [ ] T012 [P] Configure TypeScript strict mode across all packages
- [ ] T013 [P] Configure ESLint + Prettier + Husky pre-commit hooks
- [ ] T014 [P] Create shared `packages/core` with tree-sitter WASM analyzers (Python, JS, TS, Java, C#, Go, Rust)
- [ ] T015 [P] Implement Component, Dependency, Issue, Recommendation, ExternalDependency models in `packages/core/models/`
- [ ] T016 [P] Implement project scanner in `packages/core/scanner/` (file discovery, language detection)
- [ ] T017 [P] Implement dependency graph builder in `packages/core/graph/`
- [ ] T018 [P] Implement Mermaid diagram generator in `packages/core/diagrams/mermaid.ts`
- [ ] T019 [P] Implement inconsistency detectors (circular, duplication, ambiguity, naming, version conflicts, dead code)
- [ ] T020 [P] Implement recommendation engines (deprecated libs, vulnerabilities, patterns, recovery strategies)
- [ ] T021 Create `packages/db/schema.sql` for D1: projects, analyses, components, dependencies, issues, recommendations, diagrams
- [ ] T022 Create `packages/db/migrations/` with initial migration
- [ ] T023 Implement `packages/db/client.ts` - D1 query helpers with typed results
- [ ] T024 [P] Create `packages/ui/` with shared React components (Button, Card, DiagramViewer, FileUpload, Progress)

**Checkpoint**: Core analysis engine runs in Node.js test; D1 schema applied; UI components Storybook-ready

---

## Phase 2: API (Cloudflare Workers) - User Story 1: Architecture Documentation

**Goal**: REST API to submit repos, trigger analysis, retrieve results + diagrams

**Independent Test**: POST `/api/projects` -> GET `/api/projects/:id` returns architecture.md + Mermaid + PNG URLs

### Implementation for US1 - API Layer

- [ ] T025 Create Hono app in `apps/api/src/index.ts` with CORS, JSON body parsing
- [ ] T026 [P] Implement `POST /api/projects` - create project, upload repo to R2, enqueue analysis job
- [ ] T027 [P] Implement `GET /api/projects/:id` - fetch project with analysis status
- [ ] T028 [P] Implement `GET /api/projects/:id/report` - return architecture.md (markdown)
- [ ] T029 [P] Implement `GET /api/projects/:id/diagrams` - return Mermaid + PNG (signed R2 URLs)
- [ ] T030 [P] Implement `GET /api/projects` - list user's projects with pagination
- [ ] T031 Implement Queue consumer in `apps/api/src/queue-consumer.ts` - process analysis jobs
- [ ] T032 [P] Wire analysis engine: scanner -> graph -> detectors -> generators -> store in D1 + R2
- [ ] T033 Implement R2 helpers in `apps/api/src/storage.ts` - upload repo zip, download diagrams
- [ ] T034 Add request validation (Zod schemas) for all endpoints
- [ ] T035 Add structured logging (console.json) for Workers observability
- [ ] T036 [P] Write unit tests for API handlers in `apps/api/tests/`

**Checkpoint**: Deploy Workers; `curl -X POST ...` creates project, returns job ID; consumer processes and stores results

---

## Phase 3: Frontend (Cloudflare Pages/React) - User Story 1: Architecture Documentation

**Goal**: Web UI to upload repos, view analysis progress, browse architecture docs & diagrams

**Independent Test**: Open Pages URL -> drag-drop repo -> see real-time progress -> view architecture.md + interactive Mermaid diagram

### Implementation for US1 - Frontend

- [ ] T037 Scaffold React + Vite + TypeScript in `apps/web/`
- [ ] T038 [P] Configure Tailwind CSS + shadcn/ui component library
- [ ] T039 [P] Create pages: `Home` (upload), `ProjectList`, `ProjectDetail` (tabs: Overview, Diagram, Report, Issues, Recommendations)
- [ ] T040 [P] Implement file upload with drag-drop, progress, validation (zip/tar.gz, max 100MB)
- [ ] T041 Implement real-time status polling / SSE from `/api/projects/:id`
- [ ] T042 [P] Build `DiagramViewer` component - renders Mermaid.js with zoom/pan/export
- [ ] T043 [P] Build `MarkdownRenderer` component - renders architecture.md with syntax highlighting
- [ ] T044 [P] Build `ComponentTree` - interactive dependency graph (cytoscape.js or react-flow)
- [ ] T045 Implement authentication (simple JWT in cookie or Cloudflare Access)
- [ ] T046 Add error boundaries, loading skeletons, toast notifications
- [ ] T047 [P] Write component tests in `apps/web/tests/`

**Checkpoint**: Deploy to Pages; full upload -> analysis -> view flow works end-to-end

---

## Phase 4: User Story 2 - Inconsistency Detection (API + Frontend)

**Goal**: Detect and display inconsistencies, duplications, ambiguities with severity

**Independent Test**: ProjectDetail -> Issues tab shows categorized, filterable list with severity badges

### API (extends Phase 2)

- [ ] T048 [P] Extend `GET /api/projects/:id/issues` - return paginated, filterable issues
- [ ] T049 [P] Extend Queue consumer to run all inconsistency detectors and store in D1
- [ ] T050 Add issue severity aggregation endpoint `GET /api/projects/:id/issues/summary`

### Frontend (extends Phase 3)

- [ ] T051 [P] Build `IssuesTab` with filters (severity, type), sorting, search
- [ ] T052 [P] Build `IssueCard` component with expandable details, affected components links
- [ ] T053 Add issue summary dashboard cards (critical/high/medium/low counts)

**Checkpoint**: Issues tab populated after analysis completes; filters work; clicking component navigates

---

## Phase 5: User Story 3 - Actionable Recommendations (API + Frontend)

**Goal**: Generate and display prioritized recommendations with impact estimates

**Independent Test**: ProjectDetail -> Recommendations tab shows ordered list with priority, effort, impact

### API (extends Phase 2)

- [ ] T054 [P] Extend `GET /api/projects/:id/recommendations` - return prioritized recommendations
- [ ] T055 [P] Extend Queue consumer to run recommendation engines and store in D1
- [ ] T056 Implement deprecated library checker using GitHub Advisory Database API (free)
- [ ] T057 Implement vulnerability scanner using OSV.dev API (free)
- [ ] T058 Implement external dependency detector (payment, auth, cloud APIs)

### Frontend (extends Phase 3)

- [ ] T059 [P] Build `RecommendationsTab` with priority badges, effort estimates, impact scores
- [ ] T060 [P] Build `RecommendationCard` with expandable rationale, affected files, action steps
- [ ] T061 Add "Export Roadmap" button -> generates markdown/PDF of top recommendations

**Checkpoint**: Recommendations tab shows actionable items; export works; links to issue details

---

## Phase 6: Authentication & Multi-User (Cross-Cutting)

**Purpose**: Enable multiple users, private projects, team sharing

- [ ] T062 Implement Cloudflare Access integration (50 users free) OR custom JWT auth in Workers
- [ ] T063 Add user model to D1 schema; link projects to users
- [ ] T064 Implement `GET /api/auth/me` - current user profile
- [ ] T065 Add login/logout UI in frontend header
- [ ] T066 Implement project sharing (read-only links via signed R2 URLs)
- [ ] T067 Add team/organization model (optional, for future)

---

## Phase 7: Polish, Performance & Observability

**Purpose**: Production hardening, cost monitoring, UX refinement

- [ ] T068 [P] Add GitHub Actions CI: typecheck, lint, test, build for both apps
- [ ] T069 [P] Configure Cloudflare Workers Logpush to R2 for audit logs
- [ ] T070 Implement request/response caching for diagram/report endpoints (Workers KV)
- [ ] T071 Add rate limiting (100 req/min per IP) via Workers middleware
- [ ] T072 [P] Optimize bundle size: code-split tabs, lazy-load Mermaid/cytoscape
- [ ] T073 [P] Add dark mode toggle (Tailwind dark:)
- [ ] T074 [P] Create comprehensive README with architecture diagram, deployment guide
- [ ] T075 Run load test: 100 concurrent analyses, verify < 30s queue time, < 5min analysis
- [ ] T076 Dogfood: Analyze this repo, publish results as demo project

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 0 (Infra) -> Phase 1 (Core) -> Phase 2 (API) + Phase 3 (Frontend) [PARALLEL]
                                    ->
                         Phase 4 (Issues) + Phase 5 (Recs) [PARALLEL, depend on 2+3]
                                    ->
                         Phase 6 (Auth) -> Phase 7 (Polish)
```

### Parallel Opportunities

- **Phase 0**: All infra tasks (T002-T008) can run in parallel
- **Phase 1**: All core analyzers (T014-T020) + DB + UI components in parallel
- **Phase 2+3**: API and Frontend develop in parallel after Phase 1
- **Phase 4+5**: Issues and Recommendations develop in parallel
- **Phase 7**: All polish tasks marked [P] run in parallel

---

## Required APIs (External Services)

### Free Tier APIs Used

| API | Purpose | Free Tier Limit | Auth |
|-----|---------|-----------------|------|
| **Cloudflare Workers** | API runtime | 100k req/day | API Token |
| **Cloudflare Pages** | Frontend hosting | 500 builds/mo | GitHub OAuth |
| **Cloudflare D1** | SQLite database | 5M reads/day, 1GB storage | Binding |
| **Cloudflare R2** | Object storage | 10GB/mo, 1M Class A ops | Binding |
| **Cloudflare Queues** | Job queue | 1M ops/mo | Binding |
| **Cloudflare Workers KV** | Caching | 100k reads/day, 1GB | Binding |
| **Cloudflare Access** | Auth (optional) | 50 users | OIDC |
| **GitHub API** | Repo metadata, Advisory DB | 5k req/hr | PAT |
| **OSV.dev API** | Vulnerability scanning | Unlimited | None |
| **GitHub Advisory Database** | Deprecated lib detection | Via GitHub API | PAT |
| **Google Gemini API** | AI recommendations (optional) | 1.5M tokens/min, 1500 req/day | API Key |

### Internal APIs (You Build)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | POST | Create project, upload repo, enqueue job |
| `/api/projects` | GET | List user projects (paginated) |
| `/api/projects/:id` | GET | Get project status + metadata |
| `/api/projects/:id/report` | GET | Architecture markdown |
| `/api/projects/:id/diagrams` | GET | Mermaid + signed PNG URLs |
| `/api/projects/:id/issues` | GET | Paginated, filterable issues |
| `/api/projects/:id/issues/summary` | GET | Severity counts |
| `/api/projects/:id/recommendations` | GET | Prioritized recommendations |
| `/api/auth/me` | GET | Current user profile |

### Workers Bindings (No External API Calls)

```toml
# wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "arch-analysis-db"
database_id = "xxx"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "arch-analysis-assets"

[[queues]]
binding = "JOBS"
queue_name = "arch-analysis-jobs"

[[kv_namespaces]]
binding = "CACHE"
id = "xxx"
```

---

## Cost Summary: $0/month Forever

| Resource | Monthly Free Tier | Your Usage | Cost |
|----------|------------------|------------|------|
| Workers | 100k req/day | ~10k/day | $0 |
| Pages | 500 builds | ~10/mo | $0 |
| D1 | 5M reads, 1GB | ~100k reads, 100MB | $0 |
| R2 | 10GB, 1M ops | ~1GB, 100k ops | $0 |
| Queues | 1M ops | ~10k ops | $0 |
| KV | 100k reads, 1GB | ~10k reads | $0 |
| GitHub Actions | 2000 min (private) | ~500 min | $0 |
| **Total** | | | **$0** |

---

## Next Steps

1. **Run Phase 0** - Provision Cloudflare resources (15 min)
2. **Run Phase 1** - Build core analysis engine (main effort)
3. **Deploy API + Frontend** - Iterate on Phases 2-5
4. **Dogfood** - Analyze this repo as first real test