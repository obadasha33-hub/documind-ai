import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { v4 } from 'uuid'
import { AnalyzerFactory, buildDependencyGraph, calculateMetrics, findCircularDependencies, generateFullArchitectureMarkdown, generateMermaidDiagram } from '@arch-analysis/core'
import type { Component, Dependency, Issue, Recommendation } from '@arch-analysis/core'

type Bindings = {
  DB: D1Database
  ASSETS: KVNamespace
  CACHE: KVNamespace
  JOBS: Queue
  CLOUDFLARE_API_TOKEN: string
  CLOUDFLARE_ACCOUNT_ID: string
  GH_PAT: string
  GEMINI_API_KEY: string
  NODE_ENV: string
  LOG_LEVEL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())
app.use('*', logger())

// Rate limiter - 100 requests per minute per IP
const rateLimiter = async (c: any, next: any) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
  const key = `ratelimit:${ip}`
  const current = parseInt(await c.env.CACHE.get(key) || '0')
  if (current >= 100) {
    return c.json({ error: 'Too many requests' }, 429)
  }
  await c.env.CACHE.put(key, (current + 1).toString(), { expirationTtl: 60 })
  await next()
}
app.use('/api/*', rateLimiter)

// Health check with binding validation
app.get('/health', async (c) => {
  const checks: Record<string, string> = {}
  try {
    await c.env.DB.prepare('SELECT 1').first()
    checks.d1 = 'ok'
  } catch { checks.d1 = 'error' }
  checks.kv_assets = !!c.env.ASSETS ? 'ok' : 'missing'
  checks.kv_cache = !!c.env.CACHE ? 'ok' : 'missing'
  checks.queue = !!c.env.JOBS ? 'ok' : 'missing'
  const allOk = Object.values(checks).every(v => v === 'ok')
  return c.json({
    status: allOk ? 'ok' : 'degraded',
    checks,
    environment: c.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

// Create project with repo upload
app.post('/api/projects', async (c) => {
  try {
    const contentType = c.req.header('content-type') || ''

    // Handle JSON input (repo URL)
    if (contentType.includes('application/json')) {
      const body = await c.req.json() as { name: string; repoUrl?: string; branch?: string }
      if (!body.name) {
        return c.json({ error: 'Project name is required' }, 400)
      }

      const projectId = `proj-${v4().slice(0, 8)}`
      const now = new Date().toISOString()

      // Create project record
      await c.env.DB.prepare(
        `INSERT INTO projects (id, name, repo_url, repo_branch, status, user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', 'anonymous', ?, ?)`
      ).bind(projectId, body.name, body.repoUrl || null, body.branch || 'main', now, now).run()

      // Create analysis job
      await c.env.DB.prepare(
        `INSERT INTO analysis_jobs (id, project_id, status, progress, current_step, started_at)
         VALUES (?, ?, 'pending', 0, 'Queued', ?)`
      ).bind(`job-${v4().slice(0, 8)}`, projectId, now).run()

      // Enqueue to Cloudflare Queues
      await c.env.JOBS.send({
        projectId,
        repoUrl: body.repoUrl,
        repoBranch: body.branch || 'main',
      })

      return c.json({
        id: projectId,
        name: body.name,
        status: 'pending',
        message: 'Project created and analysis queued',
        _links: {
          self: `/api/projects/${projectId}`,
          report: `/api/projects/${projectId}/report`,
          diagrams: `/api/projects/${projectId}/diagrams`,
          issues: `/api/projects/${projectId}/issues`,
        }
      }, 201)
    }

    // Handle multipart upload (zip file)
    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData()
      const fileEntry = formData.get('file')
      if (!fileEntry || typeof fileEntry === 'string') {
        return c.json({ error: 'File upload is required' }, 400)
      }
      const file = fileEntry as File
      const name = (formData.get('name') as string) || file.name

      if (!file) {
        return c.json({ error: 'File is required' }, 400)
      }
      if (file.size > 10_000_000) {
        return c.json({ error: 'File size exceeds 10MB limit' }, 413)
      }

      const projectId = `proj-${v4().slice(0, 8)}`
      const assetKey = `upload:${projectId}:${file.name}`
      const now = new Date().toISOString()

      // Upload zip to KV (limit to 25MB, large files need R2)
      const buffer = await file.arrayBuffer()
      if (buffer.byteLength > 25_000_000) {
        return c.json({ error: 'File too large. 25MB max for KV.' }, 413)
      }
      await c.env.ASSETS.put(assetKey, buffer, {
        metadata: { originalName: file.name, projectId },
        expirationTtl: 86400 * 7,
      })

      // Create project
      await c.env.DB.prepare(
        `INSERT INTO projects (id, name, status, user_id, created_at, updated_at)
         VALUES (?, ?, 'pending', 'anonymous', ?, ?)`
      ).bind(projectId, name || file.name, now, now).run()

      // Create job
      await c.env.DB.prepare(
        `INSERT INTO analysis_jobs (id, project_id, status, progress, current_step, started_at)
         VALUES (?, ?, 'pending', 0, 'Queued', ?)`
      ).bind(`job-${v4().slice(0, 8)}`, projectId, now).run()

      // Enqueue
      await c.env.JOBS.send({
        projectId,
        uploadedAssetKey: assetKey,
        repoBranch: 'main',
      })

      return c.json({
        id: projectId,
        name: name || file.name,
        status: 'pending',
        message: 'Upload received, analysis queued',
        _links: {
          self: `/api/projects/${projectId}`,
          report: `/api/projects/${projectId}/report`,
          diagrams: `/api/projects/${projectId}/diagrams`,
        }
      }, 201)
    }

    return c.json({ error: 'Unsupported content type' }, 415)
  } catch (err) {
    console.error('Error creating project:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// List projects
app.get('/api/projects', async (c) => {
  const userId = 'anonymous'
  const cursor = c.req.query('cursor')
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)

  let query = 'SELECT id, name, status, repo_url, repo_branch, created_at, updated_at FROM projects WHERE user_id = ?'
  const params: any[] = [userId]

  if (cursor) {
    query += ' AND id > ?'
    params.push(cursor)
  }
  query += ' ORDER BY updated_at DESC LIMIT ?'
  params.push(limit)

  try {
    const result = await c.env.DB.prepare(query).bind(...params).all()
    const projects = result.results.map((row: any) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      repoUrl: row.repo_url,
      branch: row.repo_branch,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return c.json({
      projects,
      pagination: {
        limit,
        nextCursor: projects.length === limit ? projects[projects.length - 1].id : null,
      }
    })
  } catch (err) {
    console.error('Error listing projects:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get project
app.get('/api/projects/:id', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT id, name, status, repo_url, repo_branch, created_at, updated_at FROM projects WHERE id = ?'
    ).bind(c.req.param('id')).first()

    if (!result) return c.json({ error: 'Project not found' }, 404)

    // Get latest job
    const job = await c.env.DB.prepare(
      'SELECT id, status, progress, current_step, error FROM analysis_jobs WHERE project_id = ? ORDER BY started_at DESC LIMIT 1'
    ).bind(c.req.param('id')).first()

    return c.json({
      id: (result as any).id,
      name: (result as any).name,
      status: (result as any).status,
      repoUrl: (result as any).repo_url,
      branch: (result as any).repo_branch,
      createdAt: (result as any).created_at,
      updatedAt: (result as any).updated_at,
      analysis: job ? {
        status: (job as any).status,
        progress: (job as any).progress,
        currentStep: (job as any).current_step,
        error: (job as any).error,
      } : null,
      _links: {
        report: `/api/projects/${c.req.param('id')}/report`,
        diagrams: `/api/projects/${c.req.param('id')}/diagrams`,
        issues: `/api/projects/${c.req.param('id')}/issues`,
        recommendations: `/api/projects/${c.req.param('id')}/recommendations`,
      }
    })
  } catch (err) {
    console.error('Error getting project:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get architecture report
app.get('/api/projects/:id/report', async (c) => {
  try {
    const projectId = c.req.param('id')
    const project = await c.env.DB.prepare('SELECT id, name, status FROM projects WHERE id = ?').bind(projectId).first()
    if (!project) return c.json({ error: 'Project not found' }, 404)

    // Check cache
    const cached = await c.env.CACHE.get(`report:${projectId}`)
    if (cached) {
      const etag = await c.env.CACHE.get(`etag:${projectId}`)
      if (etag && c.req.header('if-none-match') === etag) {
        return c.body(null, 304)
      }
      c.header('ETag', etag || '')
      c.header('Cache-Control', 'public, max-age=3600')
      return c.text(cached)
    }

    // Check KV
    const report = await c.env.ASSETS.get(`report:${projectId}`)
    if (report) {
      await c.env.CACHE.put(`report:${projectId}`, report, { expirationTtl: 3600 })
      await c.env.CACHE.put(`etag:${projectId}`, String(Date.now()), { expirationTtl: 3600 })
      return c.text(report)
    }

    const status = (project as any).status
    if (status === 'pending' || status === 'analyzing') {
      return c.json({ status, message: 'Analysis still in progress' }, 202)
    }

    return c.json({ status, message: 'Report not generated' }, 404)
  } catch (err) {
    console.error('Error getting report:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get diagrams
app.get('/api/projects/:id/diagrams', async (c) => {
  try {
    const projectId = c.req.param('id')
    const diagrams = await c.env.DB.prepare(
      'SELECT id, format, description, content, created_at FROM diagrams WHERE project_id = ? ORDER BY created_at DESC'
    ).bind(projectId).all()

    const result = await Promise.all(diagrams.results.map(async (row: any) => {
      const mermaidFromKv = row.format === 'mermaid' ? await c.env.ASSETS.get(`mermaid:${projectId}`) : null
      return {
        id: row.id,
        format: row.format,
        description: row.description,
        content: mermaidFromKv || row.content,
        createdAt: row.created_at,
      }
    }))

    return c.json({ diagrams: result })
  } catch (err) {
    console.error('Error getting diagrams:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get issues
app.get('/api/projects/:id/issues', async (c) => {
  try {
    const projectId = c.req.param('id')
    const severity = c.req.query('severity')

    let query = 'SELECT * FROM issues WHERE project_id = ?'
    const params: any[] = [projectId]

    if (severity) {
      query += ' AND severity = ?'
      params.push(severity)
    }
    query += ' ORDER BY CASE severity WHEN "critical" THEN 0 WHEN "high" THEN 1 WHEN "medium" THEN 2 WHEN "low" THEN 3 END'

    const result = await c.env.DB.prepare(query).bind(...params).all()
    const issues = result.results.map((row: any) => ({
      id: row.id,
      severity: row.severity,
      type: row.type,
      title: row.title,
      description: row.description,
      affectedComponents: JSON.parse(row.affected_components),
      createdAt: row.created_at,
    }))

    return c.json({ issues })
  } catch (err) {
    console.error('Error getting issues:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get issue summary
app.get('/api/projects/:id/issues/summary', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT severity, COUNT(*) as count FROM issues WHERE project_id = ? GROUP BY severity'
    ).bind(c.req.param('id')).all()

    const summary: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const row of result.results) {
      summary[(row as any).severity] = (row as any).count
    }

    return c.json(summary)
  } catch (err) {
    console.error('Error getting issue summary:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get recommendations
app.get('/api/projects/:id/recommendations', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT * FROM recommendations WHERE project_id = ? ORDER BY CASE priority WHEN "high" THEN 0 WHEN "medium" THEN 1 WHEN "low" THEN 2 END'
    ).bind(c.req.param('id')).all()

    const recs = result.results.map((row: any) => ({
      id: row.id,
      priority: row.priority,
      effort: row.effort,
      impact: row.impact,
      title: row.title,
      description: row.description,
      rationale: row.rationale,
      actionSteps: JSON.parse(row.action_steps),
      affectedComponents: JSON.parse(row.affected_components),
      createdAt: row.created_at,
    }))

    return c.json({ recommendations: recs })
  } catch (err) {
    console.error('Error getting recommendations:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Export roadmap endpoint
app.get('/api/projects/:id/roadmap', async (c) => {
  try {
    const projectId = c.req.param('id')
    const recsResult = await c.env.DB.prepare(
      'SELECT * FROM recommendations WHERE project_id = ? ORDER BY CASE priority WHEN "high" THEN 0 WHEN "medium" THEN 1 WHEN "low" THEN 2 END'
    ).bind(projectId).all()

    const project = await c.env.DB.prepare('SELECT name FROM projects WHERE id = ?').bind(projectId).first()
    const projectName = (project as any)?.name || 'Unknown Project'

    let md = `# Roadmap: ${projectName}\n\n`
    md += `Generated: ${new Date().toISOString()}\n\n`
    md += '## Recommended Actions\n\n'
    md += '| Priority | Title | Effort | Impact |\n'
    md += '|----------|-------|--------|--------|\n'

    for (const row of recsResult.results) {
      const r = row as any
      md += `| ${r.priority} | ${r.title} | ${r.effort} | ${r.impact} |\n`
    }

    md += '\n### Details\n\n'
    for (const row of recsResult.results) {
      const r = row as any
      md += `### ${r.title}\n`
      md += `${r.description}\n\n`
      md += `**Rationale:** ${r.rationale}\n\n`
      md += '**Steps:**\n'
      const steps = JSON.parse(r.action_steps)
      for (const step of steps) {
        md += `1. ${step}\n`
      }
      md += '\n---\n\n'
    }

    return c.text(md, 200, { 'Content-Type': 'text/markdown' })
  } catch (err) {
    console.error('Error generating roadmap:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Direct process endpoint for testing
app.post('/api/projects/:id/process', async (c) => {
  try {
    const projectId = c.req.param('id')
    const result = await c.env.DB.prepare('SELECT id, name, repo_url FROM projects WHERE id = ?').bind(projectId).first()
    if (!result) return c.json({ error: 'Project not found' }, 404)

    const projectName = (result as any).name
    const now = new Date().toISOString()
    await updateJobStatus(c.env, projectId, 'running', 5, 'Creating sample components')

    // Create mock components and dependencies for demonstration
    const components: Component[] = [
      { id: 'comp-1', name: 'API Gateway', description: 'Entry point for all requests', type: 'api', language: 'TypeScript', path: 'src/gateway.ts', dependencies: ['comp-2', 'comp-3'], projectId, createdAt: now },
      { id: 'comp-2', name: 'Auth Service', description: 'User authentication and authorization', type: 'service', language: 'Python', path: 'src/auth.py', dependencies: ['comp-4'], projectId, createdAt: now },
      { id: 'comp-3', name: 'Payment Module', description: 'Payment processing', type: 'module', language: 'Python', path: 'src/payment.py', dependencies: ['comp-4'], projectId, createdAt: now },
      { id: 'comp-4', name: 'Database', description: 'PostgreSQL data store', type: 'database', language: 'SQL', path: 'db/schema.sql', dependencies: [], projectId, createdAt: now },
      { id: 'comp-5', name: 'UI Dashboard', description: 'Admin dashboard frontend', type: 'service', language: 'JavaScript', path: 'frontend/dashboard.jsx', dependencies: ['comp-1'], projectId, createdAt: now },
    ]
    const dependencies: Dependency[] = [
      { id: 'dep-1', sourceComponentId: 'comp-1', targetComponentId: 'comp-2', type: 'static', projectId, createdAt: now },
      { id: 'dep-2', sourceComponentId: 'comp-1', targetComponentId: 'comp-3', type: 'static', projectId, createdAt: now },
      { id: 'dep-3', sourceComponentId: 'comp-2', targetComponentId: 'comp-4', type: 'static', projectId, createdAt: now },
      { id: 'dep-4', sourceComponentId: 'comp-3', targetComponentId: 'comp-4', type: 'static', projectId, createdAt: now },
      { id: 'dep-5', sourceComponentId: 'comp-5', targetComponentId: 'comp-1', type: 'static', projectId, createdAt: now },
      // Circular dependency: comp-2 → comp-5 → comp-1 → comp-2
      { id: 'dep-6', sourceComponentId: 'comp-2', targetComponentId: 'comp-5', type: 'static', projectId, createdAt: now },
    ]

    await updateJobStatus(c.env, projectId, 'running', 25, 'Building dependency graph')
    const graph = buildDependencyGraph(components, dependencies)
    const cycles = findCircularDependencies(graph)
    const metrics = calculateMetrics(graph)

    await updateJobStatus(c.env, projectId, 'running', 50, 'Detecting inconsistencies')
    const issues = generateIssues(components, dependencies, cycles, metrics)

    await updateJobStatus(c.env, projectId, 'running', 70, 'Generating recommendations')
    const recs = generateRecs(issues, metrics)

    await updateJobStatus(c.env, projectId, 'running', 85, 'Generating documentation')
    const mermaidSource = generateMermaidDiagram({ components, dependencies })
    const architectureMd = generateFullArchitectureMarkdown(projectName, components, dependencies, mermaidSource)

    await updateJobStatus(c.env, projectId, 'running', 95, 'Storing results')
    await storeResults(c.env, { projectId, components, dependencies, issues, recommendations: recs, mermaidSource, architectureMd, metrics })

    await updateJobStatus(c.env, projectId, 'completed', 100, 'Analysis complete')
    // Verify diagram was stored
    const check = await c.env.DB.prepare('SELECT COUNT(*) as c FROM diagrams WHERE project_id = ?').bind(projectId).first()
    const diagramsStored = (check as any)?.c || 0
    if (diagramsStored === 0) {
      // Fallback: store diagram directly
      await c.env.DB.prepare('INSERT INTO diagrams (id, project_id, format, content, description, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(`diag-${Date.now().toString(36)}`, projectId, 'mermaid', mermaidSource, 'Architecture diagram', now).run()
      await c.env.ASSETS.put(`mermaid:${projectId}`, mermaidSource, { expirationTtl: 86400 * 30 })
      await c.env.ASSETS.put(`report:${projectId}`, architectureMd, { expirationTtl: 86400 * 30 })
    }
    return c.json({
      status: 'completed',
      projectId,
      summary: `${components.length} components, ${dependencies.length} dependencies, ${issues.length} issues, ${recs.length} recommendations`,
    })
  } catch (err) {
    console.error('Error processing:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ============================================
// QUEUE CONSUMER - processes analysis jobs
// ============================================

interface JobData {
  projectId: string
  repoUrl?: string
  repoBranch: string
  uploadedAssetKey?: string
}

async function resolveProjectFiles(data: JobData, env: Bindings): Promise<Array<{ path: string; content: string; language: string }>> {
  if (data.uploadedAssetKey) {
    const zipBuffer = await env.ASSETS.get(data.uploadedAssetKey, 'arrayBuffer')
    if (!zipBuffer) throw new Error('Uploaded asset not found')
    return []
  }
  return []
}

async function parseSourceFiles(files: Array<{ path: string; content: string; language: string }>): Promise<{ components: Component[]; dependencies: Dependency[] }> {
  const components: Component[] = []
  const dependencies: Dependency[] = []
  const factory = new AnalyzerFactory()
  const now = new Date().toISOString()
  let compId = 0
  let depId = 0

  for (const file of files) {
    const analyzer = factory.getAnalyzer(file.path)
    if (!analyzer) continue
    try {
      const result = await analyzer.analyze(file.path, file.content)
      for (const comp of result.components) {
        components.push({ ...comp, id: `comp-${compId++}`, createdAt: now, projectId: '' })
      }
      for (const dep of result.dependencies) {
        dependencies.push({ ...dep, id: `dep-${depId++}`, projectId: '', createdAt: now })
      }
    } catch (err) {
      console.error(`Failed to parse ${file.path}:`, err)
    }
  }
  return { components, dependencies }
}

function generateIssues(comps: Component[], deps: Dependency[], cycles: string[][], metrics: ReturnType<typeof calculateMetrics>): Issue[] {
  const issues: Issue[] = []
  const now = new Date().toISOString()
  for (const cycle of cycles) {
    issues.push({ id: `iss-${crypto.randomUUID().slice(0, 8)}`, projectId: '', severity: 'high', type: 'circular', title: 'Circular Dependency Detected', description: `Circular dependency between: ${cycle.join(' -> ')}`, affectedComponents: cycle, createdAt: now })
  }
  if (metrics.isolatedComponents > 0) {
    issues.push({ id: `iss-${crypto.randomUUID().slice(0, 8)}`, projectId: '', severity: 'low', type: 'dead_code', title: 'Isolated Components Found', description: `${metrics.isolatedComponents} component(s) have no dependencies in or out`, affectedComponents: [], createdAt: now })
  }
  return issues
}

function generateRecs(issues: Issue[], metrics: ReturnType<typeof calculateMetrics>): Recommendation[] {
  const recs: Recommendation[] = []
  const now = new Date().toISOString()
  if (issues.some(i => i.type === 'circular')) {
    recs.push({ id: `rec-${crypto.randomUUID().slice(0, 8)}`, projectId: '', priority: 'high', effort: 'medium', impact: 'high', title: 'Resolve Circular Dependencies', description: 'Extract shared interfaces into a common package and refactor imports.', rationale: 'Circular deps increase coupling and make testing difficult.', affectedComponents: [], actionSteps: ['Identify the shared logic in the loop', 'Create a new shared package', 'Move shared interfaces there', 'Update imports'], relatedIssues: issues.filter(i => i.type === 'circular').map(i => i.id), createdAt: now })
  }
  if (metrics.totalComponents > 20) {
    recs.push({ id: `rec-${crypto.randomUUID().slice(0, 8)}`, projectId: '', priority: 'medium', effort: 'high', impact: 'high', title: 'Consider Microservices Decomposition', description: 'The project has many components. Consider splitting into microservices.', rationale: 'Large monoliths reduce team velocity.', affectedComponents: [], actionSteps: ['Identify bounded contexts', 'Design service interfaces', 'Split incrementally'], relatedIssues: [], createdAt: now })
  }
  return recs
}

async function storeResults(env: Bindings, data: { projectId: string; components: Component[]; dependencies: Dependency[]; issues: Issue[]; recommendations: Recommendation[]; mermaidSource: string; architectureMd: string; metrics: ReturnType<typeof calculateMetrics> }): Promise<void> {
  const now = new Date().toISOString()
  if (data.components.length > 0) {
    const stmt = env.DB.prepare('INSERT OR REPLACE INTO components (id, project_id, name, description, type, language, path, dependencies, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    await env.DB.batch(data.components.map(c => stmt.bind(c.id, data.projectId, c.name, c.description, c.type, c.language, c.path, JSON.stringify(c.dependencies), now)))
  }
  if (data.dependencies.length > 0) {
    const stmt = env.DB.prepare('INSERT OR REPLACE INTO dependencies (id, project_id, source_component_id, target_component_id, type, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    await env.DB.batch(data.dependencies.map(d => stmt.bind(d.id, data.projectId, d.sourceComponentId, d.targetComponentId, d.type, now)))
  }
  if (data.issues.length > 0) {
    const stmt = env.DB.prepare('INSERT OR REPLACE INTO issues (id, project_id, severity, type, title, description, affected_components, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    await env.DB.batch(data.issues.map(i => stmt.bind(i.id, data.projectId, i.severity, i.type, i.title, i.description, JSON.stringify(i.affectedComponents), now)))
  }
  if (data.recommendations.length > 0) {
    const stmt = env.DB.prepare('INSERT OR REPLACE INTO recommendations (id, project_id, priority, effort, impact, title, description, rationale, affected_components, action_steps, related_issues, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    await env.DB.batch(data.recommendations.map(r => stmt.bind(r.id, data.projectId, r.priority, r.effort, r.impact, r.title, r.description, r.rationale, JSON.stringify(r.affectedComponents), JSON.stringify(r.actionSteps), JSON.stringify(r.relatedIssues), now)))
  }
  await env.ASSETS.put(`report:${data.projectId}`, data.architectureMd, { expirationTtl: 86400 * 30 })
  await env.ASSETS.put(`mermaid:${data.projectId}`, data.mermaidSource, { expirationTtl: 86400 * 30 })
}

async function updateJobStatus(env: Bindings, projectId: string, status: string, progress: number, currentStep: string): Promise<void> {
  const now = new Date().toISOString()
  await env.DB.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, projectId).run()
  await env.DB.prepare("UPDATE analysis_jobs SET status = ?, progress = ?, current_step = ?, completed_at = ? WHERE project_id = ? ORDER BY started_at DESC LIMIT 1").bind(status, progress, currentStep, status === 'completed' ? now : null, projectId).run()
}

async function queueHandler(batch: MessageBatch<JobData>, env: Bindings): Promise<void> {
  for (const msg of batch.messages) {
    try {
      console.log(`Processing job: ${msg.id} for project: ${msg.body.projectId}`)
      await updateJobStatus(env, msg.body.projectId, 'running', 1, 'Starting analysis')
      await updateJobStatus(env, msg.body.projectId, 'running', 10, 'Resolving files')
      const files = await resolveProjectFiles(msg.body, env)
      if (files.length === 0) { throw new Error('No files to analyze') }
      await updateJobStatus(env, msg.body.projectId, 'running', 30, 'Parsing files')
      const { components, dependencies } = await parseSourceFiles(files)
      await updateJobStatus(env, msg.body.projectId, 'running', 50, 'Building graph')
      const graph = buildDependencyGraph(components, dependencies)
      const cycles = findCircularDependencies(graph)
      const metrics = calculateMetrics(graph)
      await updateJobStatus(env, msg.body.projectId, 'running', 65, 'Detecting issues')
      const issues = generateIssues(components, dependencies, cycles, metrics)
      await updateJobStatus(env, msg.body.projectId, 'running', 80, 'Generating recommendations')
      const recs = generateRecs(issues, metrics)
      await updateJobStatus(env, msg.body.projectId, 'running', 90, 'Generating docs')
      const mermaidSource = generateMermaidDiagram({ components, dependencies })
      const architectureMd = generateFullArchitectureMarkdown(msg.body.projectId, components, dependencies, mermaidSource)
      await updateJobStatus(env, msg.body.projectId, 'running', 95, 'Storing')
      await storeResults(env, { projectId: msg.body.projectId, components, dependencies, issues, recommendations: recs, mermaidSource, architectureMd, metrics })
      await updateJobStatus(env, msg.body.projectId, 'completed', 100, 'Complete')
      console.log(`Job ${msg.id} completed`)
      msg.ack()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error(`Job ${msg.id} failed: ${errorMessage}`)
      try { await updateJobStatus(env, msg.body.projectId, 'failed', -1, errorMessage) } catch (_) {}
      if (msg.attempts < 3) { msg.retry({ delaySeconds: msg.attempts * 30 }) } else { msg.ack() }
    }
  }
}

export default {
  fetch: app.fetch,
  queue: queueHandler,
}