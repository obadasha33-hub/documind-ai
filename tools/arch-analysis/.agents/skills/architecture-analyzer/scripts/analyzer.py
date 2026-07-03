import os
import re
import json
import sys

# File types and languages mapping
LANG_EXTENSIONS = {
    '.py': 'Python',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.java': 'Java',
    '.cs': 'C#',
    '.go': 'Go',
    '.rs': 'Rust',
}

DEFAULT_EXCLUDES = {
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
    'coverage', '.turbo', '.vercel', '.venv', '__pycache__', '.agents'
}

class ArchitectureAnalyzer:
    def __init__(self, root_dir):
        self.root_dir = os.path.abspath(root_dir)
        self.components = {}  # relative_path -> component_info
        self.dependencies = []  # list of (source, target, type)
        self.languages = {}
        self.errors = []

    def scan_and_analyze(self):
        # 1. Walk directory and discover files
        for dirpath, dirnames, filenames in os.walk(self.root_dir):
            # Prune excluded directories in-place
            dirnames[:] = [d for d in dirnames if d not in DEFAULT_EXCLUDES]
            
            for filename in filenames:
                ext = os.path.splitext(filename)[1]
                if ext not in LANG_EXTENSIONS:
                    continue
                    
                filepath = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(filepath, self.root_dir).replace(os.sep, '/')
                
                # Check file size (limit to 1MB)
                try:
                    size = os.path.getsize(filepath)
                    if size > 1024 * 1024:
                        continue
                except Exception as e:
                    self.errors.append(f"Failed to check size of {rel_path}: {str(e)}")
                    continue
                
                lang = LANG_EXTENSIONS[ext]
                self.languages[lang] = self.languages.get(lang, 0) + 1
                
                # Read content
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                except Exception as e:
                    self.errors.append(f"Failed to read {rel_path}: {str(e)}")
                    continue
                
                # Analyze imports based on language
                imports = self.extract_imports(lang, content)
                
                # Heuristic module type
                mod_type = 'module'
                if '/routes/' in rel_path or '/api/' in rel_path or 'main.py' in rel_path:
                    mod_type = 'api'
                elif '/db/' in rel_path or '/database/' in rel_path or 'models.py' in rel_path:
                    mod_type = 'database'
                elif '/components/' in rel_path or '/pages/' in rel_path:
                    mod_type = 'service'
                
                self.components[rel_path] = {
                    'id': rel_path,
                    'name': filename,
                    'type': mod_type,
                    'language': lang,
                    'path': rel_path,
                    'raw_imports': imports,
                    'size': size
                }

        # 2. Resolve relative imports to file paths
        self.resolve_dependencies()

    def extract_imports(self, lang, content):
        imports = []
        if lang in ['JavaScript', 'TypeScript']:
            # import ... from 'path'
            matches = re.findall(r"import\s+(?:[^'\"]+\s+from\s+)?['\"]([^'\"]+)['\"]", content)
            imports.extend(matches)
            # require('path')
            matches = re.findall(r"require\(\s*['\"]([^'\"]+)['\"]\s*\)", content)
            imports.extend(matches)
            # export ... from 'path'
            matches = re.findall(r"export\s+.*?\s+from\s+['\"]([^'\"]+)['\"]", content)
            imports.extend(matches)
        elif lang == 'Python':
            # import module1, module2
            for match in re.finditer(r'^\s*import\s+([\w.,\s]+)', content, re.MULTILINE):
                parts = match.group(1).split(',')
                for p in parts:
                    name = p.strip().split(' as ')[0].strip()
                    if name:
                        imports.append(name)
            # from module import ...
            for match in re.finditer(r'^\s*from\s+([\w.]+)\s+import', content, re.MULTILINE):
                name = match.group(1).strip()
                if name:
                    imports.append(name)
        elif lang == 'Go':
            # Single line import
            matches = re.findall(r'^\s*import\s+"([^"]+)"', content, re.MULTILINE)
            imports.extend(matches)
            # Import block
            blocks = re.findall(r'import\s*\(\s*([\s\S]*?)\)', content)
            for block in blocks:
                for line in block.split('\n'):
                    line_match = re.search(r'"([^"]+)"', line)
                    if line_match:
                        imports.append(line_match.group(1).strip())
        elif lang == 'Rust':
            # use path::to::module;
            matches = re.findall(r'^\s*use\s+([\w:]+)', content, re.MULTILINE)
            imports.extend(matches)
        elif lang == 'Java':
            # import path.to.Class;
            matches = re.findall(r'^\s*import\s+([\w.*]+);', content, re.MULTILINE)
            imports.extend(matches)
        elif lang == 'C#':
            # using path.to.namespace;
            matches = re.findall(r'^\s*using\s+([\w.]+);', content, re.MULTILINE)
            imports.extend(matches)
        return imports

    def resolve_dependencies(self):
        for src_path, comp in self.components.items():
            resolved_list = []
            src_dir = os.path.dirname(src_path)
            
            for imp in comp['raw_imports']:
                # Heuristic relative import resolution for JS/TS/Python
                is_resolved = False
                
                # Clean import path for search
                clean_imp = imp.replace('.', '/') if comp['language'] == 'Python' and not imp.startswith('.') else imp
                
                if clean_imp.startswith('.') or comp['language'] == 'Python':
                    # Relative to source file directory
                    if comp['language'] == 'Python' and clean_imp.startswith('.'):
                        # Python relative: count dots
                        dots = len(clean_imp) - len(clean_imp.lstrip('.'))
                        clean_imp = clean_imp.lstrip('.')
                        back_dir = src_dir
                        for _ in range(dots - 1):
                            back_dir = os.path.dirname(back_dir)
                        base_search_dir = back_dir
                    else:
                        base_search_dir = src_dir
                    
                    target_rel_path = os.path.normpath(os.path.join(base_search_dir, clean_imp)).replace(os.sep, '/')
                    if target_rel_path.startswith('../'):
                        target_rel_path = target_rel_path[3:]
                    
                    # Try direct match, or with extensions
                    possible_targets = [
                        target_rel_path,
                        target_rel_path + '.ts',
                        target_rel_path + '.tsx',
                        target_rel_path + '.js',
                        target_rel_path + '.jsx',
                        target_rel_path + '.py',
                        target_rel_path + '/index.ts',
                        target_rel_path + '/index.tsx',
                        target_rel_path + '/index.js',
                    ]
                    
                    for p in possible_targets:
                        # Normalize path
                        p = os.path.normpath(p).replace(os.sep, '/')
                        if p in self.components:
                            self.dependencies.append((src_path, p, 'static'))
                            resolved_list.append(p)
                            is_resolved = True
                            break
                            
                if not is_resolved:
                    # Non-relative or external
                    self.dependencies.append((src_path, imp, 'external'))
                    resolved_list.append(imp)
            
            comp['resolved_dependencies'] = resolved_list

    def find_cycles(self):
        visited = set()
        rec_stack = set()
        cycles = []
        path = []
        
        # Build local adjacency list from resolved internal dependencies
        adj = {k: [] for k in self.components}
        for u, v, t in self.dependencies:
            if t == 'static' and u in adj and v in adj:
                adj[u].append(v)
                
        def dfs(node):
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            
            for neighbor in adj.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor)
                elif neighbor in rec_stack:
                    idx = path.index(neighbor)
                    cycle = path[idx:]
                    # Only add unique cycles (rotated versions count as same)
                    cycle_sorted = sorted(cycle)
                    if cycle_sorted not in [sorted(c) for c in cycles]:
                        cycles.append(cycle)
                        
            rec_stack.remove(node)
            path.pop()
            
        for node in self.components:
            if node not in visited:
                dfs(node)
                
        return cycles

    def generate_report(self):
        cycles = self.find_cycles()
        
        # Group by directories for Mermaid subgraphs
        groups = {}
        for path in self.components:
            parts = path.split('/')
            group_name = parts[0] if len(parts) > 1 else 'root'
            if group_name not in groups:
                groups[group_name] = []
            groups[group_name].append(path)
            
        # Build Mermaid code
        mermaid = "graph TD\n"
        for grp, nodes in groups.items():
            mermaid += f'  subgraph "{grp.upper()}"\n'
            for node in nodes:
                name = self.components[node]['name']
                mermaid += f'    {node.replace("/", "_").replace(".", "_")}["{name}"]\n'
            mermaid += "  end\n"
            
        # Draw edges
        for u, v, t in self.dependencies:
            if t == 'static' and u in self.components and v in self.components:
                u_id = u.replace("/", "_").replace(".", "_")
                v_id = v.replace("/", "_").replace(".", "_")
                mermaid += f"  {u_id} --> {v_id}\n"
                
        # Build Markdown Report
        md = f"# Architecture Specification & Analysis Report\n\n"
        md += f"Generated: {os.path.basename(self.root_dir)} codebase scan\n\n"
        
        md += "## 📊 System Overview\n\n"
        md += f"- **Total Monitored Files**: {len(self.components)}\n"
        md += f"- **Internal Connections**: {len([d for d in self.dependencies if d[2] == 'static'])}\n"
        md += f"- **External Dependencies**: {len(set(d[1] for d in self.dependencies if d[2] == 'external'))}\n"
        
        md += "\n### 🗂️ Language Distribution\n"
        for lang, count in self.languages.items():
            md += f"- **{lang}**: {count} files\n"
            
        md += "\n## 🎨 Module Interaction Flowchart\n\n"
        md += "```mermaid\n" + mermaid + "```\n\n"
        
        md += "## ⚠️ Circular Import Cycles\n\n"
        if cycles:
            md += f"**Critical Quality Gate Check: FAILED** - {len(cycles)} cycle loops detected:\n\n"
            for idx, c in enumerate(cycles):
                chain = " ➔ ".join(c) + f" ➔ {c[0]}"
                md += f"### Loop {idx + 1}\n"
                md += f"```text\n{chain}\n```\n"
                md += "**Remediation**: Break coupling by moving shared imports to an interface layer.\n\n"
        else:
            md += "✅ **Critical Quality Gate Check: PASSED** - No circular imports found.\n\n"
            
        md += "## 📦 Component Library Inventory\n\n"
        md += "| Component Path | Type | Language | Size | Dependencies |\n"
        md += "|---|---|---|---|---|\n"
        for path, comp in sorted(self.components.items()):
            deps_str = ", ".join(comp['resolved_dependencies'][:3])
            if len(comp['resolved_dependencies']) > 3:
                deps_str += "..."
            md += f"| `{path}` | {comp['type']} | {comp['language']} | {comp['size']} B | {deps_str or '-'} |\n"
            
        return md

if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    analyzer = ArchitectureAnalyzer(root)
    print("Scanning project and resolving imports...")
    analyzer.scan_and_analyze()
    print("Generating report markdown...")
    report = analyzer.generate_report()
    
    output_path = os.path.join(root, 'architecture.md')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"Success! Saved architecture report to {output_path}")
