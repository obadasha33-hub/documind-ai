// Core data models for Architecture Analysis

export interface Component {
  id: string
  name: string
  description: string
  type: 'module' | 'service' | 'library' | 'microservice' | 'api' | 'database' | 'queue' | 'cache'
  language: string
  path: string
  dependencies: string[] // Component IDs
  version?: string
  projectId: string
  createdAt: string
  metadata?: Record<string, any>
}

export interface Dependency {
  id: string
  sourceComponentId: string
  targetComponentId: string
  type: 'static' | 'dynamic' | 'runtime' | 'external'
  version?: string
  projectId: string
  createdAt: string
  metadata?: Record<string, any>
}

export interface Issue {
  id: string
  projectId: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: 'circular' | 'duplication' | 'ambiguity' | 'naming' | 'version_conflict' | 'dead_code' | 'deprecated' | 'vulnerability' | 'external_dependency'
  title: string
  description: string
  affectedComponents: string[]
  recommendationId?: string
  metadata?: Record<string, any>
  createdAt: string
}

export interface Recommendation {
  id: string
  projectId: string
  priority: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  title: string
  description: string
  rationale: string
  affectedComponents: string[]
  actionSteps: string[]
  relatedIssues: string[]
  metadata?: Record<string, any>
  createdAt: string
}

export interface ExternalDependency {
  id: string
  projectId: string
  name: string
  type: 'payment' | 'auth' | 'database' | 'messaging' | 'storage' | 'cdn' | 'monitoring' | 'ai' | 'other'
  version: string
  documentationUrl?: string
  vulnerabilities: string[] // CVE IDs
  deprecated: boolean
  replacement?: string
  metadata?: Record<string, any>
  createdAt: string
}

export interface ArchitectureDiagram {
  id: string
  projectId: string
  format: 'mermaid' | 'png' | 'svg'
  content: string // Mermaid source or base64 encoded image
  description: string
  components: string[] // Component IDs
  dependencies: string[] // Dependency IDs
  createdAt: string
}

export interface AnalysisJob {
  id: string
  projectId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  currentStep: string
  startedAt: string
  completedAt?: string
  error?: string
}

export interface Project {
  id: string
  name: string
  description?: string
  repoUrl?: string
  repoBranch?: string
  status: 'pending' | 'analyzing' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  userId: string
  settings?: {
    languages?: string[]
    excludePatterns?: string[]
    includeTests?: boolean
  }
}