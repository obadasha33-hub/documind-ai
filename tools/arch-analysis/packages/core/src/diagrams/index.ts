// Diagram Generators - Mermaid and others

import type { Component, Dependency } from '../models'

export interface DiagramOptions {
  components: Component[]
  dependencies: Dependency[]
  direction?: 'TD' | 'TB' | 'LR' | 'RL'
  theme?: 'default' | 'dark' | 'forest' | 'neutral'
  showLegend?: boolean
}

export function generateMermaidDiagram(options: DiagramOptions): string {
  const { components, dependencies, direction = 'TD', theme = 'default', showLegend = true } = options
  
  let mermaid = `graph ${direction}\n`
  
  // Add theme
  if (theme !== 'default') {
    mermaid += `%%{init: {'theme': '${theme}'}}%%\n`
  }
  
  // Group components by type for subgraphs
  const componentsByType = new Map<string, Component[]>()
  for (const component of components) {
    if (!componentsByType.has(component.type)) {
      componentsByType.set(component.type, [])
    }
    componentsByType.get(component.type)!.push(component)
  }
  
  // Add subgraphs
  for (const [type, comps] of componentsByType) {
    mermaid += `  subgraph "${type}s"\n`
    for (const comp of comps) {
      const label = comp.name.replace(/"/g, '\\"')
      mermaid += `    ${comp.id}["${label}"]\n`
    }
    mermaid += `  end\n`
  }
  
  // Add dependencies
  for (const dep of dependencies) {
    const arrow = dep.type === 'external' ? '-.->' : '-->'
    mermaid += `  ${dep.sourceComponentId} ${arrow} ${dep.targetComponentId}\n`
  }
  
  // Add clickable links (for web)
  if (showLegend) {
    mermaid += `\n  click ${Array.from(componentsByType.values()).flat().map(c => c.id).join(' ')} "javascript:void(0)"\n`
  }
  
  return mermaid
}

export function generateMermaidSequenceDiagram(components: Component[], dependencies: Dependency[]): string {
  let mermaid = 'sequenceDiagram\n'
  
  // Add participants
  for (const comp of components) {
    mermaid += `  participant ${comp.id} as "${comp.name}"\n`
  }
  
  // Add interactions based on dependencies
  for (const dep of dependencies) {
    mermaid += `  ${dep.sourceComponentId}->>${dep.targetComponentId}: calls\n`
  }
  
  return mermaid
}

export function generateComponentListMarkdown(components: Component[]): string {
  let md = '# Components\n\n'
  
  const byType = new Map<string, Component[]>()
  for (const comp of components) {
    if (!byType.has(comp.type)) {
      byType.set(comp.type, [])
    }
    byType.get(comp.type)!.push(comp)
  }
  
  for (const [type, comps] of byType) {
    md += `## ${type.charAt(0).toUpperCase() + type.slice(1)}s\n\n`
    for (const comp of comps) {
      md += `### ${comp.name}\n`
      md += `- **Type**: ${comp.type}\n`
      md += `- **Language**: ${comp.language}\n`
      md += `- **Path**: ${comp.path}\n`
      if (comp.description) {
        md += `- **Description**: ${comp.description}\n`
      }
      if (comp.dependencies.length > 0) {
        md += `- **Dependencies**: ${comp.dependencies.length}\n`
      }
      md += '\n'
    }
  }
  
  return md
}

export function generateDependencyTableMarkdown(dependencies: Dependency[], components: Component[]): string {
  const compMap = new Map(components.map(c => [c.id, c.name]))
  
  let md = '# Dependencies\n\n'
  md += '| Source | Target | Type | Version |\n'
  md += '|--------|--------|------|---------|\n'
  
  for (const dep of dependencies) {
    const sourceName = compMap.get(dep.sourceComponentId) || dep.sourceComponentId
    const targetName = compMap.get(dep.targetComponentId) || dep.targetComponentId
    md += `| ${sourceName} | ${targetName} | ${dep.type} | ${dep.version || '-' } |\n`
  }
  
  return md
}

export function generateFullArchitectureMarkdown(
  projectName: string,
  components: Component[],
  dependencies: Dependency[],
  mermaidDiagram: string
): string {
  let md = `# Architecture: ${projectName}\n\n`
  md += `Generated: ${new Date().toISOString()}\n\n`
  md += `## Overview\n\n`
  md += `- **Total Components**: ${components.length}\n`
  md += `- **Total Dependencies**: ${dependencies.length}\n`
  md += `- **Languages**: ${[...new Set(components.map(c => c.language))].join(', ')}\n\n`
  
  md += `## Architecture Diagram\n\n`
  md += `\`\`\`mermaid\n${mermaidDiagram}\n\`\`\`\n\n`
  
  md += generateComponentListMarkdown(components)
  md += generateDependencyTableMarkdown(dependencies, components)
  
  return md
}