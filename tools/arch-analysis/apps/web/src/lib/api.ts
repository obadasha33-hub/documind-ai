const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export interface ProjectSummary {
  id: string
  name: string
  status: string
  repoUrl?: string
  branch?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectDetail extends ProjectSummary {
  analysis: {
    status: string
    progress: number
    currentStep: string
    error: string | null
  } | null
  _links: Record<string, string>
}

export interface Issue {
  id: string
  severity: string
  type: string
  title: string
  description: string
  affectedComponents: string[]
  createdAt: string
}

export interface Recommendation {
  id: string
  priority: string
  effort: string
  impact: string
  title: string
  description: string
  rationale: string
  actionSteps: string[]
  createdAt: string
}

export interface Diagram {
  id: string
  format: string
  description: string
  content: string | null
  createdAt: string
}

export const api = {
  health: () => request<{ status: string; checks: Record<string, string> }>('/health'),

  createProject: (name: string, repoUrl?: string) =>
    request<{ id: string; name: string; status: string; _links: Record<string, string> }>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, repoUrl }),
    }),

  processProject: (id: string) =>
    request<{ status: string; projectId: string; summary?: string }>(`/projects/${id}/process`, {
      method: 'POST',
    }),

  listProjects: () =>
    request<{ projects: ProjectSummary[] }>('/projects'),

  getProject: (id: string) =>
    request<ProjectDetail>(`/projects/${id}`),

  getIssues: (id: string) =>
    request<{ issues: Issue[] }>(`/projects/${id}/issues`),

  getIssueSummary: (id: string) =>
    request<Record<string, number>>(`/projects/${id}/issues/summary`),

  getRecommendations: (id: string) =>
    request<{ recommendations: Recommendation[] }>(`/projects/${id}/recommendations`),

  getDiagrams: (id: string) =>
    request<{ diagrams: Diagram[] }>(`/projects/${id}/diagrams`),

  getReport: async (id: string): Promise<string> => {
    const res = await fetch(`${API_BASE}/projects/${id}/report`)
    if (!res.ok) throw new Error('Report not generated')
    return res.text()
  },
}