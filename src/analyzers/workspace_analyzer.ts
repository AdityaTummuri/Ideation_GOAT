import * as fs from 'fs';
import * as path from 'path';

export const FRAMEWORK_SIGNATURES: Record<string, string> = {
  // Python
  'fastapi': 'FastAPI',
  'flask': 'Flask',
  'django': 'Django',
  'streamlit': 'Streamlit',
  'torch': 'PyTorch',
  'tensorflow': 'TensorFlow',
  'langchain': 'LangChain',
  'chromadb': 'ChromaDB',
  // JS / TS
  'express': 'Express',
  'fastify': 'Fastify',
  '@nestjs/core': 'NestJS',
  'next': 'Next.js',
  'react': 'React',
  'vue': 'Vue',
  'svelte': 'Svelte',
  'tailwindcss': 'Tailwind CSS',
  // Rust
  'actix-web': 'Actix-Web',
  'axum': 'Axum',
  'tokio': 'Tokio',
  'rocket': 'Rocket',
  // Go
  'github.com/gin-gonic/gin': 'Gin',
  'github.com/gofiber/fiber': 'Fiber',
  'github.com/labstack/echo': 'Echo',
};

export interface WorkspaceProfile {
  path: string;
  primary_language: string;
  languages_detected: string[];
  frameworks_detected: string[];
  dependencies: string[];
  build_tools: string[];
  error?: string;
}

export function analyzeWorkspace(workspacePath?: string): WorkspaceProfile {
  const targetPath = workspacePath ? path.resolve(workspacePath) : process.cwd();

  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
    return {
      path: targetPath,
      primary_language: 'Unknown',
      languages_detected: [],
      frameworks_detected: [],
      dependencies: [],
      build_tools: [],
      error: `Path '${targetPath}' does not exist or is not a directory.`
    };
  }

  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const dependencies = new Set<string>();
  const buildTools = new Set<string>();

  // 1. Inspect dependency manifests
  const pkgJsonPath = path.join(targetPath, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    buildTools.add('npm/pnpm');
    languages.add('JavaScript');
    if (fs.existsSync(path.join(targetPath, 'tsconfig.json'))) {
      languages.add('TypeScript');
    }
    try {
      const data = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      for (const section of ['dependencies', 'devDependencies']) {
        if (data[section] && typeof data[section] === 'object') {
          for (const dep of Object.keys(data[section])) {
            dependencies.add(dep);
            if (dep in FRAMEWORK_SIGNATURES) {
              frameworks.add(FRAMEWORK_SIGNATURES[dep]);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const reqTxtPath = path.join(targetPath, 'requirements.txt');
  if (fs.existsSync(reqTxtPath)) {
    buildTools.add('pip');
    languages.add('Python');
    try {
      const lines = fs.readFileSync(reqTxtPath, 'utf8').split('\n');
      for (const line of lines) {
        const clean = line.trim().split('#')[0];
        if (clean) {
          const pkgMatch = /^([a-zA-Z0-9_\-\[\]]+)/.exec(clean);
          if (pkgMatch) {
            const pkg = pkgMatch[1].toLowerCase();
            dependencies.add(pkg);
            if (pkg in FRAMEWORK_SIGNATURES) {
              frameworks.add(FRAMEWORK_SIGNATURES[pkg]);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const pyprojectPath = path.join(targetPath, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    buildTools.add('poetry/pip');
    languages.add('Python');
    try {
      const content = fs.readFileSync(pyprojectPath, 'utf8');
      for (const [key, name] of Object.entries(FRAMEWORK_SIGNATURES)) {
        const regex = new RegExp(`['"]${key}['"]`, 'i');
        if (regex.test(content)) {
          frameworks.add(name);
          dependencies.add(key);
        }
      }
    } catch {
      // ignore
    }
  }

  const cargoPath = path.join(targetPath, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    buildTools.add('cargo');
    languages.add('Rust');
    try {
      const content = fs.readFileSync(cargoPath, 'utf8');
      for (const [key, name] of Object.entries(FRAMEWORK_SIGNATURES)) {
        const regex = new RegExp(`${key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*=`);
        if (regex.test(content)) {
          frameworks.add(name);
          dependencies.add(key);
        }
      }
    } catch {
      // ignore
    }
  }

  const goModPath = path.join(targetPath, 'go.mod');
  if (fs.existsSync(goModPath)) {
    buildTools.add('go');
    languages.add('Go');
    try {
      const content = fs.readFileSync(goModPath, 'utf8');
      for (const [key, name] of Object.entries(FRAMEWORK_SIGNATURES)) {
        if (content.includes(key)) {
          frameworks.add(name);
          dependencies.add(key.split('/').pop() || key);
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. AST-lite source code scan (check top source files for imports)
  let filesChecked = 0;
  
  function walkDir(currentDir: string) {
    if (filesChecked >= 30) return;
    
    let files: string[];
    try {
      files = fs.readdirSync(currentDir);
    } catch {
      return;
    }

    for (const file of files) {
      if (filesChecked >= 30) return;
      const fullPath = path.join(currentDir, file);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (['node_modules', 'venv', '.venv', '.git', '__pycache__', 'chroma_data', 'dist', 'build'].includes(file)) {
          continue;
        }
        walkDir(fullPath);
      } else {
        const ext = path.extname(file).toLowerCase();
        if (['.py', '.ts', '.js', '.jsx', '.tsx', '.go', '.rs'].includes(ext)) {
          filesChecked++;
          if (ext === '.py') languages.add('Python');
          else if (['.ts', '.tsx'].includes(ext)) languages.add('TypeScript');
          else if (['.js', '.jsx'].includes(ext)) languages.add('JavaScript');
          else if (ext === '.go') languages.add('Go');
          else if (ext === '.rs') languages.add('Rust');

          try {
            const fd = fs.openSync(fullPath, 'r');
            const buffer = Buffer.alloc(4096);
            const bytesRead = fs.readSync(fd, buffer, 0, 4096, null);
            fs.closeSync(fd);
            
            const code = buffer.toString('utf8', 0, bytesRead);
            for (const [key, name] of Object.entries(FRAMEWORK_SIGNATURES)) {
              if (!frameworks.has(name)) {
                if (ext === '.py') {
                  const regex = new RegExp(`^\\s*(?:import|from)\\s+${key}\\b`, 'm');
                  if (regex.test(code)) {
                    frameworks.add(name);
                  }
                } else if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
                  const regex = new RegExp(`(?:import|require)\\s*\\(?["'].*?${key}.*?["']\\)?`);
                  if (regex.test(code)) {
                    frameworks.add(name);
                  }
                }
              }
            }
          } catch {
            // ignore
          }
        }
      }
    }
  }

  walkDir(targetPath);

  // Determine primary language
  let primaryLanguage = 'Unknown';
  if (languages.has('Python')) {
    primaryLanguage = 'Python';
  } else if (languages.has('TypeScript')) {
    primaryLanguage = 'TypeScript';
  } else if (languages.has('JavaScript')) {
    primaryLanguage = 'JavaScript';
  } else if (languages.has('Rust')) {
    primaryLanguage = 'Rust';
  } else if (languages.has('Go')) {
    primaryLanguage = 'Go';
  } else if (languages.size > 0) {
    primaryLanguage = Array.from(languages)[0];
  }

  return {
    path: targetPath,
    primary_language: primaryLanguage,
    languages_detected: Array.from(languages).sort(),
    frameworks_detected: Array.from(frameworks).sort(),
    dependencies: Array.from(dependencies).sort(),
    build_tools: Array.from(buildTools).sort()
  };
}
