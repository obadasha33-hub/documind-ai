import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type ProjectSummary } from '../lib/api'

export function Home() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.listProjects()
      .then(d => setProjects(d.projects))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setError('')
    try {
      const proj = await api.createProject(name.trim())
      await api.processProject(proj.id)
      navigate(`/projects/${proj.id}`)
    } catch (err: any) {
      setError(err.message)
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Architecture Analyzer</h1>
          <Link to="/projects" className="text-sm text-blue-600 hover:underline">All Projects</Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Analyze Your Codebase
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Upload any project and get architecture diagrams, dependency analysis, issue detection, and actionable recommendations — all free.
          </p>
        </div>

        {/* Create Form */}
        <div className="max-w-lg mx-auto mb-12">
          <form onSubmit={handleCreate} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Name
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. my-app"
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </form>
        </div>

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Projects</h3>
            <Link to="/projects" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent"></div>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">No projects yet. Enter a name above and click Analyze.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.slice(0, 6).map(p => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white truncate">{p.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      p.status === 'completed' ? 'bg-green-100 text-green-800' :
                      p.status === 'failed' ? 'bg-red-100 text-red-800' :
                      p.status === 'running' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>{p.status}</span>
                  </div>
                  <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleString()}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-2">Architecture Docs</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Auto-generated architecture.md with Mermaid diagrams and component breakdown</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-2">Issue Detection</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Circular dependencies, dead code, duplication, naming conflicts</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-2">Recommendations</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Prioritized fixes with effort estimates and actionable steps</p>
          </div>
        </div>
      </div>
    </div>
  )
}