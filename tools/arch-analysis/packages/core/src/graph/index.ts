// Dependency Graph Builder

import type { Component, Dependency } from '../models'

export interface GraphNode {
  id: string
  component: Component
  incoming: string[]
  outgoing: string[]
}

export interface Graph {
  nodes: Map<string, GraphNode>
  edges: Dependency[]
}

export function buildDependencyGraph(components: Component[], dependencies: Dependency[]): Graph {
  const nodes = new Map<string, GraphNode>()
  
  // Initialize nodes
  for (const component of components) {
    nodes.set(component.id, {
      id: component.id,
      component,
      incoming: [],
      outgoing: [],
    })
  }
  
  // Add edges
  for (const dep of dependencies) {
    const source = nodes.get(dep.sourceComponentId)
    const target = nodes.get(dep.targetComponentId)
    
    if (source && target) {
      source.outgoing.push(dep.targetComponentId)
      target.incoming.push(dep.sourceComponentId)
    }
  }
  
  return { nodes, edges: dependencies }
}

export function findCircularDependencies(graph: Graph): string[][] {
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const cycles: string[][] = []
  const path: string[] = []
  
  function dfs(nodeId: string) {
    visited.add(nodeId)
    recursionStack.add(nodeId)
    path.push(nodeId)
    
    const node = graph.nodes.get(nodeId)
    if (node) {
      for (const neighbor of node.outgoing) {
        if (!visited.has(neighbor)) {
          dfs(neighbor)
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor)
          cycles.push(path.slice(cycleStart))
        }
      }
    }
    
    recursionStack.delete(nodeId)
    path.pop()
  }
  
  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId)
    }
  }
  
  return cycles
}

export function getTopologicalOrder(graph: Graph): string[] {
  const visited = new Set<string>()
  const temp = new Set<string>()
  const order: string[] = []
  
  function visit(nodeId: string) {
    if (temp.has(nodeId)) {
      throw new Error('Graph has a cycle')
    }
    if (!visited.has(nodeId)) {
      temp.add(nodeId)
      const node = graph.nodes.get(nodeId)
      if (node) {
        for (const neighbor of node.outgoing) {
          visit(neighbor)
        }
      }
      temp.delete(nodeId)
      visited.add(nodeId)
      order.unshift(nodeId)
    }
  }
  
  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      visit(nodeId)
    }
  }
  
  return order
}

export function calculateMetrics(graph: Graph): {
  totalComponents: number
  totalDependencies: number
  avgDependenciesPerComponent: number
  maxDependencies: number
  isolatedComponents: number
} {
  let totalDeps = 0
  let maxDeps = 0
  let isolated = 0
  
  for (const node of graph.nodes.values()) {
    const depCount = node.incoming.length + node.outgoing.length
    totalDeps += depCount
    maxDeps = Math.max(maxDeps, depCount)
    if (depCount === 0) isolated++
  }
  
  return {
    totalComponents: graph.nodes.size,
    totalDependencies: graph.edges.length,
    avgDependenciesPerComponent: graph.nodes.size > 0 ? totalDeps / graph.nodes.size : 0,
    maxDependencies: maxDeps,
    isolatedComponents: isolated,
  }
}