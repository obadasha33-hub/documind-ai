# Quickstart: Project Architecture Analysis

**Purpose**: Validate the project architecture analysis tool with a runnable example.

## Prerequisites

- Python 3.11+
- `pip` (Python package manager)
- `graphviz` (for PNG diagram generation)
- `mermaid-cli` (for Mermaid diagram generation)

## Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Install `graphviz`**:
   - **macOS**: `brew install graphviz`
   - **Linux**: `sudo apt-get install graphviz`
   - **Windows**: Download from [Graphviz Official Site](https://graphviz.org/download/)

4. **Install `mermaid-cli`**:
   ```bash
   npm install -g @mermaid-js/mermaid-cli
   ```

## Run the Analysis

1. **Analyze a project**:
   ```bash
   python -m src.cli analyze --path /path/to/project --output specs/001-project-architecture-spec/output
   ```

2. **Generate diagrams**:
   ```bash
   python -m src.cli generate-diagrams --path specs/001-project-architecture-spec/output
   ```

3. **View the report**:
   - Open `specs/001-project-architecture-spec/output/report.md` in a markdown viewer.
   - View diagrams in `specs/001-project-architecture-spec/output/diagrams/`.

## Expected Output

- **`report.md`**: Summary of findings, including components, dependencies, issues, and recommendations.
- **`diagrams/`**: 
  - `architecture.mermaid`: Mermaid diagram of the project architecture.
  - `architecture.png`: PNG diagram of the project architecture.

## Validation Scenarios

1. **Component Detection**: Verify that all modules, services, and libraries are identified.
2. **Dependency Analysis**: Confirm that dependencies between components are accurately represented.
3. **Issue Detection**: Check that inconsistencies, duplications, and circular dependencies are flagged.
4. **Diagram Generation**: Ensure that Mermaid and PNG diagrams are generated and accurately represent the architecture.