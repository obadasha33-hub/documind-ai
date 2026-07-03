<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:

- [Implementation Plan: Project Architecture Analysis](./specs/001-project-architecture-spec/plan.md)

<!-- SPECKIT END -->

---

# 🤖 Workspace Agent Guidelines & Architecture Analysis

This project integrates the **architecture-analyzer** Workspace Skill to run codebase analysis natively and coordinates specialized subagents to resolve issues.

## 🛠️ How to run the analysis
Run the zero-dependency Python static analyzer to walk directories, map relative module imports, check for circular imports, and output a `architecture.md` report at the root:
```bash
python .agents/skills/architecture-analyzer/scripts/analyzer.py .
```

## 👥 Multi-Agent Collaboration Workflow (Squad Roles)
When using the `/agent` or `/agents` CLI commands, delegate work to specialized subagents to refactor issues found in `architecture.md`:
* **Director / Lead Architect**: Runs `analyzer.py`, evaluates dependency flows, and manages modular boundaries.
* **Lead Backend (DeepSeek V4 Pro)**: Resolves code cycles, handles database optimizations, and fixes API routing anomalies.
* **DevOps Auditor (Nemotron 3 Ultra)**: Hardens Docker setups and manages secret environments.
* **QA Debugger (GLM 5.1)**: Runs pytest/vitest verification loops to ensure code changes do not introduce new regressions.

