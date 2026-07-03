# Research: Project Architecture Analysis

**Purpose**: Document technical decisions and research findings for the project architecture analysis tool.

## Decisions

### 1. Multi-Language Code Analysis

**Decision**: Use `tree-sitter` for parsing code in multiple languages.

**Rationale**:
- `tree-sitter` is a parser generator tool and incremental parsing library that supports **40+ languages**.
- Provides **accurate syntax trees** for code, enabling precise analysis of components and dependencies.
- Lightweight and fast, suitable for large codebases.
- Actively maintained and widely adopted (e.g., GitHub, VS Code).

**Alternatives Considered**:
- **Custom parsers**: High maintenance overhead; not scalable for multiple languages.
- **Language-specific AST libraries**: Requires integrating multiple libraries; inconsistent APIs.
- **LLVM-based tools**: Overkill for static analysis; steep learning curve.

---

### 2. Detecting Circular Dependencies

**Decision**: Use **static analysis** with dependency graph traversal.

**Rationale**:
- **Static analysis** is efficient and works without running the code.
- **Dependency graph traversal** (e.g., DFS) can detect cycles in module imports or file dependencies.
- **Visualization** of cycles helps users understand and fix issues.

**Alternatives Considered**:
- **Dynamic analysis**: Requires running the code; not feasible for all projects.
- **Hybrid analysis**: Combines static and dynamic analysis; adds complexity without significant benefits.

---

### 3. Inferring Architecture from Undocumented Code

**Decision**: Combine **heuristic-based analysis** and **machine learning** (optional).

**Rationale**:
- **Heuristic-based analysis** uses naming conventions, directory structures, and import patterns to infer architecture.
- **Machine learning** (e.g., clustering, NLP) can improve accuracy but is optional for the MVP.
- **User input** can refine inferences (e.g., marking false positives).

**Alternatives Considered**:
- **Manual documentation**: Not scalable; defeats the purpose of automated analysis.
- **Full ML-based analysis**: Requires large datasets and training; overkill for MVP.

---

### 4. Generating Mermaid and PNG Diagrams

**Decision**: Use `mermaid-cli` for Mermaid diagrams and `graphviz` for PNG.

**Rationale**:
- **`mermaid-cli`**: Converts Mermaid syntax to SVG/PNG; integrates well with markdown.
- **`graphviz`**: Industry-standard for graph visualization; supports complex layouts.
- Both tools are **open-source** and **free** to use.

**Alternatives Considered**:
- **Custom diagram generators**: High development effort; reinventing the wheel.
- **Commercial tools**: Incur costs; violate the $0 budget constraint.

---

### 5. Flagging Deprecated Libraries

**Decision**: Use **public vulnerability databases** (e.g., GitHub Advisory Database, Snyk) and **version checks**.

**Rationale**:
- **Public databases** provide up-to-date information on deprecated and vulnerable libraries.
- **Version checks** compare project dependencies against known vulnerable versions.
- **Lightweight** and **cost-effective** (no external API costs).

**Alternatives Considered**:
- **Static analysis tools**: Limited to specific languages; may not cover all dependencies.
- **Commercial vulnerability scanners**: Incur costs; violate the $0 budget constraint.

---

### 6. Fallback Mechanisms for External Dependency Failures

**Decision**: Implement **retry logic** and **offline caching** for external dependencies.

**Rationale**:
- **Retry logic** handles transient failures (e.g., network timeouts).
- **Offline caching** stores results of external checks for future use.
- **User notifications** inform users of failures and fallback actions.

**Alternatives Considered**:
- **Fallback to local analysis**: May miss critical updates; reduces accuracy.
- **Ignore failures**: Unreliable; degrades user experience.