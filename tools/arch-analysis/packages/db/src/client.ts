// D1 Database Client with typed queries
import type { D1Database } from '@cloudflare/workers-types'
import type {
  Project,
  Component,
  Dependency,
  Issue,
  Recommendation,
  ExternalDependency,
  ArchitectureDiagram,
  AnalysisJob,
} from '@arch-analysis/core'

export class DBClient {
  constructor(private db: D1Database) {}

  // Projects
  async createProject(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = new Date().toISOString()
    const fullProject = { ...project, createdAt: now, updatedAt: now }
    await this.db.prepare(`
      INSERT INTO projects (id, name, description, repo_url, repo_branch, status, user_id, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fullProject.id,
      fullProject.name,
      fullProject.description ?? null,
      fullProject.repoUrl ?? null,
      fullProject.repoBranch ?? 'main',
      fullProject.status,
      fullProject.userId,
      fullProject.settings ? JSON.stringify(fullProject.settings) : null,
      fullProject.createdAt,
      fullProject.updatedAt
    ).run()
    return fullProject
  }

  async getProject(id: string): Promise<Project | null> {
    const result = await this.db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first()
    return result ? this.mapProject(result) : null
  }

  async listProjects(userId: string, limit = 20, offset = 0): Promise<{ projects: Project[], total: number }> {
    const projects = await this.db.prepare(`
      SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all()
    const totalResult = await this.db.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ?').bind(userId).first()
    const total = (totalResult?.count as number) || 0
    return { projects: projects.results.map(this.mapProject), total }
  }

  async updateProjectStatus(id: string, status: Project['status']): Promise<void> {
    await this.db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
      .bind(status, new Date().toISOString(), id).run()
  }

  // Components
  async createComponents(components: Omit<Component, 'createdAt'>[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO components (id, project_id, name, description, type, language, path, dependencies, version, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const batch = components.map(c => stmt.bind(
      c.id, c.projectId, c.name, c.description ?? null, c.type, c.language, c.path,
      JSON.stringify(c.dependencies), c.version ?? null, c.metadata ? JSON.stringify(c.metadata) : null,
      new Date().toISOString()
    ))
    await this.db.batch(batch)
  }

  async getComponents(projectId: string): Promise<Component[]> {
    const result = await this.db.prepare('SELECT * FROM components WHERE project_id = ?').bind(projectId).all()
    return result.results.map(this.mapComponent)
  }

  // Dependencies
  async createDependencies(dependencies: Omit<Dependency, 'createdAt'>[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO dependencies (id, project_id, source_component_id, target_component_id, type, version, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const batch = dependencies.map(d => stmt.bind(
      d.id, d.projectId, d.sourceComponentId, d.targetComponentId, d.type, d.version ?? null,
      d.metadata ? JSON.stringify(d.metadata) : null, new Date().toISOString()
    ))
    await this.db.batch(batch)
  }

  async getDependencies(projectId: string): Promise<Dependency[]> {
    const result = await this.db.prepare('SELECT * FROM dependencies WHERE project_id = ?').bind(projectId).all()
    return result.results.map(this.mapDependency)
  }

  // Issues
  async createIssues(issues: Omit<Issue, 'createdAt'>[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO issues (id, project_id, severity, type, title, description, affected_components, recommendation_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const batch = issues.map(i => stmt.bind(
      i.id, i.projectId, i.severity, i.type, i.title, i.description,
      JSON.stringify(i.affectedComponents), i.recommendationId ?? null,
      i.metadata ? JSON.stringify(i.metadata) : null, new Date().toISOString()
    ))
    await this.db.batch(batch)
  }

  async getIssues(projectId: string, severity?: Issue['severity']): Promise<Issue[]> {
    let query = 'SELECT * FROM issues WHERE project_id = ?'
    const params = [projectId]
    if (severity) {
      query += ' AND severity = ?'
      params.push(severity)
    }
    query += ' ORDER BY CASE severity WHEN "critical" THEN 0 WHEN "high" THEN 1 WHEN "medium" THEN 2 WHEN "low" THEN 3 END'
    const result = await this.db.prepare(query).bind(...params).all()
    return result.results.map(this.mapIssue)
  }

  async getIssueSummary(projectId: string): Promise<Record<Issue['severity'], number>> {
    const result = await this.db.prepare(`
      SELECT severity, COUNT(*) as count FROM issues WHERE project_id = ? GROUP BY severity
    `).bind(projectId).all()
    const summary: Record<Issue['severity'], number> = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const row of result.results) {
      summary[row.severity as Issue['severity']] = row.count as number
    }
    return summary
  }

  // Recommendations
  async createRecommendations(recs: Omit<Recommendation, 'createdAt'>[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO recommendations (id, project_id, priority, effort, impact, title, description, rationale, affected_components, action_steps, related_issues, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const batch = recs.map(r => stmt.bind(
      r.id, r.projectId, r.priority, r.effort, r.impact, r.title, r.description, r.rationale,
      JSON.stringify(r.affectedComponents), JSON.stringify(r.actionSteps), JSON.stringify(r.relatedIssues),
      r.metadata ? JSON.stringify(r.metadata) : null, new Date().toISOString()
    ))
    await this.db.batch(batch)
  }

  async getRecommendations(projectId: string): Promise<Recommendation[]> {
    const result = await this.db.prepare(`
      SELECT * FROM recommendations WHERE project_id = ?
      ORDER BY CASE priority WHEN "high" THEN 0 WHEN "medium" THEN 1 WHEN "low" THEN 2 END
    `).bind(projectId).all()
    return result.results.map(this.mapRecommendation)
  }

  // External Dependencies
  async createExternalDeps(deps: Omit<ExternalDependency, 'createdAt'>[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO external_dependencies (id, project_id, name, type, version, documentation_url, vulnerabilities, deprecated, replacement, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const batch = deps.map(d => stmt.bind(
      d.id,
      d.projectId,
      d.name,
      d.type,
      d.version,
      d.documentationUrl ?? null,
      JSON.stringify(d.vulnerabilities),
      d.deprecated ? 1 : 0,
      d.replacement ?? null,
      d.metadata ? JSON.stringify(d.metadata) : null,
      new Date().toISOString()
    ))
    await this.db.batch(batch)
  }

  async getExternalDeps(projectId: string): Promise<ExternalDependency[]> {
    const result = await this.db.prepare('SELECT * FROM external_dependencies WHERE project_id = ?').bind(projectId).all()
    return result.results.map(this.mapExternalDep)
  }

  // Diagrams
  async createDiagram(diagram: Omit<ArchitectureDiagram, 'createdAt'>): Promise<void> {
    await this.db.prepare(`
      INSERT INTO diagrams (id, project_id, format, content, description, components, dependencies, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      diagram.id, diagram.projectId, diagram.format, diagram.content, diagram.description ?? null,
      JSON.stringify(diagram.components), JSON.stringify(diagram.dependencies), new Date().toISOString()
    ).run()
  }

  async getDiagrams(projectId: string): Promise<ArchitectureDiagram[]> {
    const result = await this.db.prepare('SELECT * FROM diagrams WHERE project_id = ?').bind(projectId).all()
    return result.results.map(this.mapDiagram)
  }

  // Analysis Jobs
  async createJob(job: Omit<AnalysisJob, 'startedAt'>): Promise<void> {
    await this.db.prepare(`
      INSERT INTO analysis_jobs (id, project_id, status, progress, current_step, started_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(job.id, job.projectId, job.status, job.progress, job.currentStep, new Date().toISOString()).run()
  }

  async updateJob(id: string, updates: Partial<AnalysisJob>): Promise<void> {
    const fields: string[] = []
    const values: any[] = []
    if (updates.status) { fields.push('status = ?'); values.push(updates.status) }
    if (updates.progress !== undefined) { fields.push('progress = ?'); values.push(updates.progress) }
    if (updates.currentStep) { fields.push('current_step = ?'); values.push(updates.currentStep) }
    if (updates.completedAt) { fields.push('completed_at = ?'); values.push(updates.completedAt) }
    if (updates.error) { fields.push('error = ?'); values.push(updates.error) }
    if (!fields.length) return
    values.push(id)
    await this.db.prepare(`UPDATE analysis_jobs SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
  }

  async getJob(id: string): Promise<AnalysisJob | null> {
    const result = await this.db.prepare('SELECT * FROM analysis_jobs WHERE id = ?').bind(id).first()
    return result ? this.mapJob(result) : null
  }

  // Row mappers
  private mapProject = (row: any): Project => ({
    id: row.id,
    name: row.name,
    description: row.description,
    repoUrl: row.repo_url,
    repoBranch: row.repo_branch,
    status: row.status,
    userId: row.user_id,
    settings: row.settings ? JSON.parse(row.settings) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })

  private mapComponent = (row: any): Component => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    type: row.type,
    language: row.language,
    path: row.path,
    dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
    version: row.version,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  })

  private mapDependency = (row: any): Dependency => ({
    id: row.id,
    projectId: row.project_id,
    sourceComponentId: row.source_component_id,
    targetComponentId: row.target_component_id,
    type: row.type,
    version: row.version,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  })

  private mapIssue = (row: any): Issue => ({
    id: row.id,
    projectId: row.project_id,
    severity: row.severity,
    type: row.type,
    title: row.title,
    description: row.description,
    affectedComponents: JSON.parse(row.affected_components),
    recommendationId: row.recommendation_id,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  })

  private mapRecommendation = (row: any): Recommendation => ({
    id: row.id,
    projectId: row.project_id,
    priority: row.priority,
    effort: row.effort,
    impact: row.impact,
    title: row.title,
    description: row.description,
    rationale: row.rationale,
    affectedComponents: JSON.parse(row.affected_components),
    actionSteps: JSON.parse(row.action_steps),
    relatedIssues: row.related_issues ? JSON.parse(row.related_issues) : [],
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  })

  private mapExternalDep = (row: any): ExternalDependency => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    type: row.type,
    version: row.version,
    documentationUrl: row.documentation_url,
    vulnerabilities: JSON.parse(row.vulnerabilities || '[]'),
    deprecated: !!row.deprecated,
    replacement: row.replacement,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  })

  private mapDiagram = (row: any): ArchitectureDiagram => ({
    id: row.id,
    projectId: row.project_id,
    format: row.format,
    content: row.content,
    description: row.description,
    components: row.components ? JSON.parse(row.components) : [],
    dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
    createdAt: row.created_at,
  })

  private mapJob = (row: any): AnalysisJob => ({
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    progress: row.progress,
    currentStep: row.current_step,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    error: row.error,
  })
}

export function createDBClient(db: D1Database): DBClient {
  return new DBClient(db)
}