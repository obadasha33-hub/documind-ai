// Language-specific analyzers using tree-sitter

export interface AnalyzerResult {
  components: import('../models').Component[]
  dependencies: import('../models').Dependency[]
  errors: string[]
}

export interface Analyzer {
  language: string
  extensions: string[]
  analyze(filePath: string, content: string): Promise<AnalyzerResult>
  canAnalyze(filePath: string): boolean
}

export abstract class BaseAnalyzer implements Analyzer {
  abstract language: string
  abstract extensions: string[]
  
  canAnalyze(filePath: string): boolean {
    return this.extensions.some(ext => filePath.endsWith(ext))
  }
  
  abstract analyze(filePath: string, content: string): Promise<AnalyzerResult>
  
  protected createComponent(
    id: string,
    name: string,
    type: import('../models').Component['type'],
    language: string,
    path: string,
    dependencies: string[] = [],
    projectId: string = ''
  ): import('../models').Component {
    return {
      id,
      name,
      description: '',
      type,
      language,
      path,
      dependencies,
      projectId,
      createdAt: new Date().toISOString(),
    }
  }
  
  protected createDependency(
    id: string,
    sourceId: string,
    targetId: string,
    type: import('../models').Dependency['type'] = 'static',
    projectId: string = ''
  ): import('../models').Dependency {
    return {
      id,
      sourceComponentId: sourceId,
      targetComponentId: targetId,
      type,
      projectId,
      createdAt: new Date().toISOString(),
    }
  }
}

// Python Analyzer
export class PythonAnalyzer extends BaseAnalyzer {
  language = 'Python'
  extensions = ['.py']
  
  async analyze(filePath: string, content: string): Promise<AnalyzerResult> {
    const components: import('../models').Component[] = []
    const dependencies: import('../models').Dependency[] = []
    const errors: string[] = []
    
    const fileId = filePath
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1)
    
    const type: import('../models').Component['type'] = 'module'
    const importedPaths: string[] = []
    
    const importRegex = /^\s*import\s+([\w.,\s]+)/gm
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const parts = match[1].split(',')
      for (const part of parts) {
        const name = part.trim().split(/\s+as\s+/)[0].trim()
        if (name && !importedPaths.includes(name)) {
          importedPaths.push(name)
        }
      }
    }
    
    const fromImportRegex = /^\s*from\s+([\w.]+)\s+import/gm
    while ((match = fromImportRegex.exec(content)) !== null) {
      const name = match[1].trim()
      if (name && !importedPaths.includes(name)) {
        importedPaths.push(name)
      }
    }
    
    const resolvedDeps: string[] = []
    for (const imp of importedPaths) {
      const depType = imp.startsWith('.') ? 'static' : 'external'
      const depId = `${fileId}->${imp}`
      dependencies.push(this.createDependency(depId, fileId, imp, depType))
      resolvedDeps.push(imp)
    }
    
    components.push(this.createComponent(fileId, fileName, type, this.language, filePath, resolvedDeps))
    
    return {
      components,
      dependencies,
      errors,
    }
  }
}

// JavaScript/TypeScript Analyzer
export class JavaScriptAnalyzer extends BaseAnalyzer {
  language = 'JavaScript'
  extensions = ['.js', '.jsx', '.ts', '.tsx']
  
  async analyze(filePath: string, content: string): Promise<AnalyzerResult> {
    const components: import('../models').Component[] = []
    const dependencies: import('../models').Dependency[] = []
    const errors: string[] = []
    
    const fileId = filePath
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1)
    
    let type: import('../models').Component['type'] = 'module'
    if (filePath.includes('/routes/') || filePath.includes('/api/')) {
      type = 'api'
    } else if (filePath.includes('/db/') || filePath.includes('/database/')) {
      type = 'database'
    } else if (filePath.includes('/components/') || filePath.includes('/pages/')) {
      type = 'service'
    }
    
    const importedPaths: string[] = []
    
    const importRegex = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const imp = match[1]
      if (imp && !importedPaths.includes(imp)) {
        importedPaths.push(imp)
      }
    }
    
    const requireRegex = /require\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = requireRegex.exec(content)) !== null) {
      const imp = match[1]
      if (imp && !importedPaths.includes(imp)) {
        importedPaths.push(imp)
      }
    }

    const exportRegex = /export\s+.*?\s+from\s+['"]([^'"]+)['"]/g
    while ((match = exportRegex.exec(content)) !== null) {
      const imp = match[1]
      if (imp && !importedPaths.includes(imp)) {
        importedPaths.push(imp)
      }
    }
    
    const resolvedDeps: string[] = []
    for (const imp of importedPaths) {
      const depType = (imp.startsWith('.') || imp.startsWith('/')) ? 'static' : 'external'
      const depId = `${fileId}->${imp}`
      dependencies.push(this.createDependency(depId, fileId, imp, depType))
      resolvedDeps.push(imp)
    }
    
    components.push(this.createComponent(fileId, fileName, type, this.language, filePath, resolvedDeps))
    
    return {
      components,
      dependencies,
      errors,
    }
  }
}

// Java Analyzer
export class JavaAnalyzer extends BaseAnalyzer {
  language = 'Java'
  extensions = ['.java']
  
  async analyze(filePath: string, content: string): Promise<AnalyzerResult> {
    const components: import('../models').Component[] = []
    const dependencies: import('../models').Dependency[] = []
    const errors: string[] = []
    
    const fileId = filePath
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1)
    const type: import('../models').Component['type'] = 'module'
    const importedPaths: string[] = []
    
    const importRegex = /^\s*import\s+([\w.*]+);/gm
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const imp = match[1].trim()
      if (imp && !importedPaths.includes(imp)) {
        importedPaths.push(imp)
      }
    }
    
    const resolvedDeps: string[] = []
    for (const imp of importedPaths) {
      const depType = imp.startsWith('java.') || imp.startsWith('javax.') ? 'external' : 'static'
      const depId = `${fileId}->${imp}`
      dependencies.push(this.createDependency(depId, fileId, imp, depType))
      resolvedDeps.push(imp)
    }
    
    components.push(this.createComponent(fileId, fileName, type, this.language, filePath, resolvedDeps))
    
    return {
      components,
      dependencies,
      errors,
    }
  }
}

// C# Analyzer
export class CSharpAnalyzer extends BaseAnalyzer {
  language = 'C#'
  extensions = ['.cs']
  
  async analyze(filePath: string, content: string): Promise<AnalyzerResult> {
    const components: import('../models').Component[] = []
    const dependencies: import('../models').Dependency[] = []
    const errors: string[] = []
    
    const fileId = filePath
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1)
    const type: import('../models').Component['type'] = 'module'
    const importedPaths: string[] = []
    
    const usingRegex = /^\s*using\s+([\w.]+);/gm
    let match
    while ((match = usingRegex.exec(content)) !== null) {
      const imp = match[1].trim()
      if (imp && !importedPaths.includes(imp)) {
        importedPaths.push(imp)
      }
    }
    
    const resolvedDeps: string[] = []
    for (const imp of importedPaths) {
      const depType = imp.startsWith('System') || imp.startsWith('Microsoft') ? 'external' : 'static'
      const depId = `${fileId}->${imp}`
      dependencies.push(this.createDependency(depId, fileId, imp, depType))
      resolvedDeps.push(imp)
    }
    
    components.push(this.createComponent(fileId, fileName, type, this.language, filePath, resolvedDeps))
    
    return {
      components,
      dependencies,
      errors,
    }
  }
}

// Go Analyzer
export class GoAnalyzer extends BaseAnalyzer {
  language = 'Go'
  extensions = ['.go']
  
  async analyze(filePath: string, content: string): Promise<AnalyzerResult> {
    const components: import('../models').Component[] = []
    const dependencies: import('../models').Dependency[] = []
    const errors: string[] = []
    
    const fileId = filePath
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1)
    const type: import('../models').Component['type'] = 'module'
    const importedPaths: string[] = []
    
    // Match single import: import "path"
    const singleImportRegex = /^\s*import\s+"([^"]+)"/gm
    let match
    while ((match = singleImportRegex.exec(content)) !== null) {
      const imp = match[1].trim()
      if (imp && !importedPaths.includes(imp)) {
        importedPaths.push(imp)
      }
    }
    
    // Match import block: import ( ... )
    const importBlockRegex = /import\s*\(\s*([\s\S]*?)\)/g
    while ((match = importBlockRegex.exec(content)) !== null) {
      const block = match[1]
      const lines = block.split('\n')
      for (const line of lines) {
        const lineMatch = /"([^"]+)"/.exec(line)
        if (lineMatch) {
          const imp = lineMatch[1].trim()
          if (imp && !importedPaths.includes(imp)) {
            importedPaths.push(imp)
          }
        }
      }
    }
    
    const resolvedDeps: string[] = []
    for (const imp of importedPaths) {
      // Check if standard library or external module
      const isStd = !imp.includes('.')
      const depType = isStd ? 'external' : 'static'
      const depId = `${fileId}->${imp}`
      dependencies.push(this.createDependency(depId, fileId, imp, depType))
      resolvedDeps.push(imp)
    }
    
    components.push(this.createComponent(fileId, fileName, type, this.language, filePath, resolvedDeps))
    
    return {
      components,
      dependencies,
      errors,
    }
  }
}

// Rust Analyzer
export class RustAnalyzer extends BaseAnalyzer {
  language = 'Rust'
  extensions = ['.rs']
  
  async analyze(filePath: string, content: string): Promise<AnalyzerResult> {
    const components: import('../models').Component[] = []
    const dependencies: import('../models').Dependency[] = []
    const errors: string[] = []
    
    const fileId = filePath
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1)
    const type: import('../models').Component['type'] = 'module'
    const importedPaths: string[] = []
    
    // Match: use path::to::module;
    const useRegex = /^\s*use\s+([\w:]+)/gm
    let match
    while ((match = useRegex.exec(content)) !== null) {
      const imp = match[1].trim()
      if (imp && !importedPaths.includes(imp)) {
        importedPaths.push(imp)
      }
    }
    
    // Match: extern crate path;
    const crateRegex = /^\s*extern\s+crate\s+(\w+);/gm
    while ((match = crateRegex.exec(content)) !== null) {
      const imp = match[1].trim()
      if (imp && !importedPaths.includes(imp)) {
        importedPaths.push(imp)
      }
    }
    
    const resolvedDeps: string[] = []
    for (const imp of importedPaths) {
      const depType = imp.startsWith('std::') || imp.startsWith('core::') ? 'external' : 'static'
      const depId = `${fileId}->${imp}`
      dependencies.push(this.createDependency(depId, fileId, imp, depType))
      resolvedDeps.push(imp)
    }
    
    components.push(this.createComponent(fileId, fileName, type, this.language, filePath, resolvedDeps))
    
    return {
      components,
      dependencies,
      errors,
    }
  }
}

// Analyzer Factory
export class AnalyzerFactory {
  private analyzers: Analyzer[] = [
    new PythonAnalyzer(),
    new JavaScriptAnalyzer(),
    new JavaAnalyzer(),
    new CSharpAnalyzer(),
    new GoAnalyzer(),
    new RustAnalyzer(),
  ]
  
  getAnalyzer(filePath: string): Analyzer | null {
    return this.analyzers.find(a => a.canAnalyze(filePath)) || null
  }
  
  getAllAnalyzers(): Analyzer[] {
    return this.analyzers
  }
  
  getSupportedLanguages(): string[] {
    return this.analyzers.map(a => a.language)
  }
}