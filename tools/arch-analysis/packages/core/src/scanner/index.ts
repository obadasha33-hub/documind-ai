// Project Scanner - File discovery and language detection

import { AnalyzerFactory } from '../analyzers'
import type { Component, Dependency } from '../models'

export interface ScanOptions {
  rootPath: string
  excludePatterns?: string[]
  includePatterns?: string[]
  maxFileSize?: number
  maxFiles?: number
}

export interface ScanResult {
  files: ScannedFile[]
  languages: Map<string, number>
  totalSize: number
  errors: string[]
}

export interface ScannedFile {
  path: string
  relativePath: string
  language: string
  size: number
  content?: string
}

const DEFAULT_EXCLUDE = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.turbo',
  '.vercel',
  '*.min.js',
  '*.min.css',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
]

const LANGUAGE_MAP: Record<string, string> = {
  '.py': 'Python',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.java': 'Java',
  '.cs': 'C#',
  '.go': 'Go',
  '.rs': 'Rust',
  '.php': 'PHP',
  '.rb': 'Ruby',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.c': 'C',
  '.h': 'C/C++',
  '.hpp': 'C++',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.scala': 'Scala',
  '.clj': 'Clojure',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.hrl': 'Erlang',
  '.ml': 'OCaml',
  '.mli': 'OCaml',
  '.fs': 'F#',
  '.fsx': 'F#',
  '.vb': 'Visual Basic',
  '.pl': 'Perl',
  '.pm': 'Perl',
  '.lua': 'Lua',
  '.r': 'R',
  '.jl': 'Julia',
  '.dart': 'Dart',
  '.zig': 'Zig',
  '.nim': 'Nim',
  '.cr': 'Crystal',
}

export class ProjectScanner {
  private analyzerFactory = new AnalyzerFactory()
  private excludePatterns: string[]
  private includePatterns: string[]
  private maxFileSize: number
  private maxFiles: number
  
  constructor(options: Partial<ScanOptions> = {}) {
    this.excludePatterns = options.excludePatterns || DEFAULT_EXCLUDE
    this.includePatterns = options.includePatterns || []
    this.maxFileSize = options.maxFileSize || 1024 * 1024 // 1MB
    this.maxFiles = options.maxFiles || 10000
  }
  
  async scan(rootPath: string): Promise<ScanResult> {
    const files: ScannedFile[] = []
    const languages = new Map<string, number>()
    let totalSize = 0
    const errors: string[] = []
    
    try {
      const fs = await (import('fs/promises' as any).catch(() => null)) as any
      const pathModule = await (import('path' as any).catch(() => null)) as any
      
      if (fs && pathModule) {
        const walk = async (dir: string) => {
          const entries = await fs.readdir(dir, { withFileTypes: true })
          for (const entry of entries) {
            const fullPath = pathModule.join(dir, entry.name)
            const relPath = pathModule.relative(rootPath, fullPath).replace(/\\/g, '/')
            
            if (this.shouldExclude(relPath)) {
              continue
            }
            
            if (entry.isDirectory()) {
              await walk(fullPath)
            } else if (entry.isFile()) {
              const stat = await fs.stat(fullPath)
              if (stat.size > this.maxFileSize) {
                continue
              }
              if (files.length >= this.maxFiles) {
                break
              }
              
              const language = this.detectLanguage(entry.name)
              let content: string | undefined
              try {
                content = await fs.readFile(fullPath, 'utf8')
              } catch (e: any) {
                errors.push(`Failed to read file ${relPath}: ${e.message}`)
              }
              
              files.push({
                path: fullPath,
                relativePath: relPath,
                language,
                size: stat.size,
                content,
              })
              
              languages.set(language, (languages.get(language) || 0) + 1)
              totalSize += stat.size
            }
          }
        }
        await walk(rootPath)
      } else {
        errors.push('File system scanner not available in this environment')
      }
    } catch (e: any) {
      errors.push(`Scan error: ${e.message}`)
    }
    
    return {
      files,
      languages,
      totalSize,
      errors,
    }
  }
  
  private shouldExclude(relativePath: string): boolean {
    // Check exclude patterns
    for (const pattern of this.excludePatterns) {
      if (this.matchPattern(relativePath, pattern)) {
        return true
      }
    }
    
    // Check include patterns (if any specified)
    if (this.includePatterns.length > 0) {
      let included = false
      for (const pattern of this.includePatterns) {
        if (this.matchPattern(relativePath, pattern)) {
          included = true
          break
        }
      }
      if (!included) return true
    }
    
    return false
  }
  
  private matchPattern(path: string, pattern: string): boolean {
    // Simple glob matching
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(`^${regex}$`).test(path)
  }
  
  private detectLanguage(filePath: string): string {
    const ext = filePath.substring(filePath.lastIndexOf('.'))
    return LANGUAGE_MAP[ext] || 'Unknown'
  }
  
  getAnalyzerFactory(): AnalyzerFactory {
    return this.analyzerFactory
  }
}

export function createScanner(options?: Partial<ScanOptions>): ProjectScanner {
  return new ProjectScanner(options)
}