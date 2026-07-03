---
name: architecture-analyzer
description: Native project architecture static analyzer and dependency graph mapper. Summon this skill to scan codebases, find cycle loops, and output markdown documents directly.
---

# Skill: Native Architecture Codebase Analyzer

This skill enables the Antigravity agent (and its subagents) to perform static code analysis, resolve relative module imports, detect circular references, and generate high-fidelity Mermaid diagrams directly on the local machine using Python.

---

## 🛠️ Execution Protocol

When a user requests to review the project, generate system documentation, or run cycle detection, follow these steps:

### 1. Execute the Local Analyzer Script
Run the pre-configured Python static analyzer script in the sandbox (or locally if bypass is approved):
```bash
python .agents/skills/architecture-analyzer/scripts/analyzer.py .
```
This script runs a zero-dependency recursive directory walker that parses JS/TS, Python, Go, Rust, Java, and C# source files, resolves relative module import chains, detects circular references, and writes a detailed `architecture.md` file directly in the workspace root directory.

### 2. Read the Generated Report
Read the generated [architecture.md](file:///C:/Users/LENOVO/Documents/Saas/architecture.md) file to inspect the detected modules, dependencies, and circular reference cycles.

### 3. Delegate Tasks to Specialized Agent Squad
Use the `/agent spawn` command or invoke subagents (using `define_subagent` and `invoke_subagent` APIs) to work on the issues highlighted in the report:

* **Product Architect (Gemini 3.5 Flash High)**: Reviews the generated `architecture.md` and updates the high-level specs/diagrams.
* **Lead Backend (DeepSeek V4 Pro)**: Resolves the circular import loops or restructures the database context layers.
* **QA Debugger (GLM 5.1)**: Writes pytest or vitest unit tests to ensure that the imports do not regress.
* **DevOps Auditor (Nemotron 3 Ultra)**: Hardens configurations, Dockerfiles, and manages environment variables.

---

## 🚦 Guidelines for Agent Squad Collaboration
* **Always run the analyzer first** before proposing structural changes.
* **Always write a unit test** validating any broken circular dependency loop once refactored.
* **Never commit circular dependencies** back to the main branch.
* If the codebase language is Python, ensure relative imports in the codebase match the workspace layout.
