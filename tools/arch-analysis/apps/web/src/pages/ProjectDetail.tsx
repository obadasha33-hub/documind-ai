import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type Issue, type Recommendation, type Diagram } from '../lib/api'

type TabId = 'overview' | 'diagram' | 'report' | 'issues' | 'recs'

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'diagram', label: 'Diagram' },
  { id: 'report', label: 'Report' },
  { id: 'issues', label: 'Issues' },
  { id: 'recs', label: 'Recommendations' },
]

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [projectName, setProjectName] = useState('')
  const [status, setStatus] = useState('loading')
  const [report, setReport] = useState('')
  const [mermaid, setMermaid] = useState('')
  const [issues, setIssues] = useState<Issue[]>([])
  const [issueSummary, setIssueSummary] = useState<Record<string, number>>({})
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [diagrams, setDiagrams] = useState<Diagram[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')

  useEffect(() => { if (id) loadProject(id) }, [id])

  async function loadProject(projectId: string) {
    try {
      setStatus('loading')
      const proj = await api.getProject(projectId)
      setProjectName(proj.name)
      setStatus(proj.status)
      if (proj.analysis) {
        setProgress(proj.analysis.progress)
        setCurrentStep(proj.analysis.currentStep)
      }

      if (proj.status === 'completed' || proj.status === 'failed') {
        const [iss, issSum, recsData, diags] = await Promise.all([
          api.getIssues(projectId).catch(() => ({ issues: [] })),
          api.getIssueSummary(projectId).catch(() => ({})),
          api.getRecommendations(projectId).catch(() => ({ recommendations: [] })),
          api.getDiagrams(projectId).catch(() => ({ diagrams: [] })),
        ])
        setIssues(iss.issues)
        setIssueSummary(issSum)
        setRecs(recsData.recommendations)
        setDiagrams(diags.diagrams)
        if (diags.diagrams.length > 0 && diags.diagrams[0].content) {
          setMermaid(diags.diagrams[0].content)
        }

        try {
          const rep = await api.getReport(projectId)
          setReport(rep)
        } catch {} // Report not ready yet
      }
    } catch (err: any) {
      setError(err.message)
      setStatus('error')
    }
  }

  const renderTab = () => {
    if (status === 'loading') {
      return (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
        </div>
      )
    }

    if (status === 'error') {
      return <div className="p-6 text-red-600">Error loading project: {error}</div>
    }

    if (status !== 'completed' && status !== 'failed') {
      return (
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Analysis in Progress</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{currentStep || 'Waiting...'}</p>
          <div className="mt-4 w-full max-w-md mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${Math.max(5, progress)}%` }}></div>
          </div>
          <p className="text-sm text-gray-400 mt-2">{progress}%</p>
          <button
            onClick={() => id && loadProject(id)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      )
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-xl font-bold capitalize">{status}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Issues</p>
                <p className="text-xl font-bold text-red-600">{issues.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Critical</p>
                <p className="text-xl font-bold text-red-700">{issueSummary.critical || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">High</p>
                <p className="text-xl font-bold text-orange-600">{issueSummary.high || 0}</p>
              </div>
            </div>
            {recs.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold mb-3">Top Recommendation</h3>
                <p className="text-blue-600 font-medium">{recs[0].title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{recs[0].description}</p>
              </div>
            )}
          </div>
        )

      case 'diagram':
        return (
          <div className="p-6">
            {mermaid ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 h-[600px] p-4 overflow-auto">
                <pre className="text-sm text-gray-900 dark:text-gray-100">{mermaid}</pre>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-12">No diagram available</p>
            )}
          </div>
        )

      case 'report':
        return (
          <div className="p-6">
            {report ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 overflow-auto max-h-[70vh]">
                <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{report}</pre>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-12">Report not available</p>
            )}
          </div>
        )

      case 'issues':
        return (
          <div className="p-6 space-y-3">
            {issues.length === 0 ? (
              <p className="text-gray-500 text-center py-12">No issues found</p>
            ) : (
              issues.map((iss) => (
                <div key={iss.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      iss.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      iss.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                      iss.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{iss.severity}</span>
                    <p className="font-medium text-sm">{iss.title}</p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-1">{iss.description}</p>
                </div>
              ))
            )}
          </div>
        )

      case 'recs':
        return (
          <div className="p-6 space-y-3">
            {recs.length === 0 ? (
              <p className="text-gray-500 text-center py-12">No recommendations</p>
            ) : (
              recs.map((rec) => (
                <div key={rec.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                      rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>{rec.priority}</span>
                    <p className="font-medium text-sm">{rec.title}</p>
                    <span className="text-xs text-gray-400 ml-auto">{rec.effort} effort, {rec.impact} impact</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{rec.description}</p>
                  {rec.actionSteps.length > 0 && (
                    <ol className="list-decimal ml-5 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {rec.actionSteps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  )}
                </div>
              ))
            )}
          </div>
        )
    }
  }

  if (status === 'loading' && !projectName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/projects"
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              &larr; Back to Projects
            </Link>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate max-w-xs">{projectName || id}</h1>
          </div>
          <Link
            to="/"
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6">
        <div className="max-w-6xl mx-auto flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-6 px-6">
        {renderTab()}
      </main>
    </div>
  )
}