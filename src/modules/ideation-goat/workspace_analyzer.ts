import * as fs from 'fs';
import * as path from 'path';
import { settings } from './config.js';
import { makeGithubRequest, parseOwnerRepo } from './analyzers/github_public_api.js';

export class WorkspaceAnalyzer {
  /**
   * Validates that the scanned path resides within the configured workspace root boundary.
   */
  private validateWorkspacePath(pathStr: string): string {
    const target = path.resolve(pathStr);
    const root = path.resolve(settings.WORKSPACE_ROOT);
    if (!target.startsWith(root)) {
      throw new Error(`Security Violation: Scanned path '${target}' is outside the allowed root '${root}'.`);
    }
    return target;
  }

  /**
   * Verify if a target GitHub repository is a good technical and legal fit for the local workspace.
   * Checks local files for language/license limits, then compares them against the target repository.
   */
  public async verifyWorkspaceFit(repoName: string, workspacePath: string = '.'): Promise<string> {
    let validatedPath = '';
    try {
      validatedPath = this.validateWorkspacePath(workspacePath);
    } catch (err: any) {
      console.error(`Workspace validation failed: ${err.message}`);
      return `Error: ${err.message}`;
    }

    const detectedLanguages = new Set<string>();
    const detectedLicenses = new Set<string>();

    // 1. Scan local workspace directory (up to depth 2)
    try {
      const walkDir = (currentDir: string, baseDir: string) => {
        let files: string[];
        try {
          files = fs.readdirSync(currentDir);
        } catch {
          return;
        }

        const depth = path.relative(baseDir, currentDir).split(path.sep).filter(Boolean).length;
        if (depth > 2) {
          return;
        }

        for (const file of files) {
          const fullPath = path.join(currentDir, file);
          let stat: fs.Stats;
          try {
            stat = fs.statSync(fullPath);
          } catch {
            continue;
          }

          if (stat.isDirectory()) {
            if (['.git', 'node_modules', '.venv', 'venv', '__pycache__', 'chroma_data', 'dist', 'build'].includes(file)) {
              continue;
            }
            walkDir(fullPath, baseDir);
          } else {
            const fileLower = file.toLowerCase();

            // Ecosystem Detection
            if (fileLower === 'package.json') {
              detectedLanguages.add('JavaScript/TypeScript');
              try {
                const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                if (data.license) {
                  if (typeof data.license === 'object' && data.license.type) {
                    detectedLicenses.add(data.license.type);
                  } else if (typeof data.license === 'string') {
                    detectedLicenses.add(data.license);
                  }
                }
              } catch {
                // ignore
              }
            } else if (['requirements.txt', 'poetry.lock', 'pipfile', 'pyproject.toml'].includes(fileLower)) {
              detectedLanguages.add('Python');
            } else if (fileLower === 'cargo.toml') {
              detectedLanguages.add('Rust');
              try {
                const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
                for (const line of lines) {
                  if (line.trim().startsWith('license')) {
                    const parts = line.split('=');
                    if (parts.length > 1) {
                      const lic = parts[1].trim().replace(/^["']|["']$/g, '');
                      detectedLicenses.add(lic);
                    }
                  }
                }
              } catch {
                // ignore
              }
            } else if (fileLower === 'go.mod') {
              detectedLanguages.add('Go');
            } else if (['cmakelists.txt', 'makefile'].includes(fileLower)) {
              detectedLanguages.add('C/C++');
            }

            // License File Detections
            if (['license', 'license.txt', 'license.md', 'copying', 'copying.txt'].includes(fileLower)) {
              try {
                const content = fs.readFileSync(fullPath, 'utf8').slice(0, 500).toLowerCase();
                if (content.includes('mit license') || content.includes('mit')) {
                  detectedLicenses.add('MIT');
                } else if (content.includes('apache license') || content.includes('apache')) {
                  detectedLicenses.add('Apache-2.0');
                } else if (content.includes('gnu general public license') || content.includes('gpl')) {
                  if (content.includes('version 3')) {
                    detectedLicenses.add('GPL-3.0');
                  } else {
                    detectedLicenses.add('GPL');
                  }
                } else if (content.includes('bsd')) {
                  detectedLicenses.add('BSD');
                }
              } catch {
                // ignore
              }
            }
          }
        }
      };

      walkDir(validatedPath, validatedPath);
    } catch (err: any) {
      return `Error scanning workspace files: ${err.message}`;
    }

    if (detectedLanguages.size === 0) {
      detectedLanguages.add('Not specified');
    }

    let workspaceLicense = 'Proprietary';
    if (detectedLicenses.size > 0) {
      workspaceLicense = Array.from(detectedLicenses)[0];
    }

    // 2. Get target repo license and language from GitHub API
    const ownerRepo = parseOwnerRepo(repoName);
    if (!ownerRepo) {
      return `Error: Could not parse target repository identifier from: ${repoName}`;
    }

    let targetLang = 'Unknown';
    let targetLicense = 'Unknown';

    try {
      const repoData = await makeGithubRequest(`/repos/${ownerRepo}`);
      if (!repoData) {
        return `Error: Could not fetch GitHub repository metadata for: ${ownerRepo}`;
      }

      targetLang = repoData.language || 'Unknown';
      if (repoData.license) {
        targetLicense = repoData.license.spdx_id || repoData.license.key || repoData.license.name || 'Unknown';
      }
    } catch (err: any) {
      return `Error fetching GitHub repository metadata: ${err.message}`;
    }

    // 3. Perform compatibility mapping checks
    let langMatch = false;
    for (const wl of detectedLanguages) {
      if (wl.toLowerCase() === 'not specified') {
        langMatch = true;
        break;
      }
      if (wl.toLowerCase().includes(targetLang.toLowerCase()) || targetLang.toLowerCase().includes(wl.toLowerCase())) {
        langMatch = true;
      } else if (['javascript', 'typescript'].some((kw) => wl.toLowerCase().includes(kw))) {
        if (['javascript', 'typescript'].some((kw) => targetLang.toLowerCase().includes(kw))) {
          langMatch = true;
        }
      }
    }

    const copyleftLicenses = ['gpl', 'gpl-3.0', 'gpl-2.0', 'agpl-3.0', 'agpl', 'lgpl', 'lgpl-3.0', 'lgpl-2.1'];
    const permissiveLicenses = ['mit', 'apache-2.0', 'bsd-3-clause', 'bsd-2-clause', 'unlicense', 'cc0-1.0'];

    const isTargetCopyleft = copyleftLicenses.some((cl) => targetLicense.toLowerCase().includes(cl));
    const isWorkspacePermissive = permissiveLicenses.some((p) => workspaceLicense.toLowerCase().includes(p)) || workspaceLicense.toLowerCase() === 'proprietary';

    let licenseConflict = false;
    let licenseWarning = '';
    if (isTargetCopyleft && isWorkspacePermissive) {
      licenseConflict = true;
      licenseWarning =
        `⚠️ **License Conflict Warning**: The workspace license is '${workspaceLicense}' (permissive/proprietary), ` +
        `but the target repo '${repoName}' uses '${targetLicense}' (copyleft). ` +
        `Integrating copyleft code into a proprietary or permissively licensed workspace ` +
        `may force the entire project to be licensed under copyleft terms.`;
    }

    let status = 'Compatible';
    if (!langMatch) {
      status = 'Language Mismatch';
    }
    if (licenseConflict) {
      status = status === 'Compatible' ? 'License Conflict' : 'Conflict & Mismatch';
    }

    // 4. Generate scorecard report
    const output: string[] = [];
    output.push(`## 📋 Workspace Compatibility Scorecard for \`${repoName}\``);
    output.push('');
    output.push('| Feature | Workspace Environment | Target Repository | Match Status |');
    output.push('| --- | --- | --- | --- |');
    output.push(`| **Language** | ${Array.from(detectedLanguages).join(', ')} | ${targetLang} | ${langMatch ? '✅ Match' : '❌ Mismatch'} |`);
    output.push(`| **License** | ${workspaceLicense} | ${targetLicense} | ${licenseConflict ? '⚠️ Copyleft Warning' : '✅ Permissive / Compatible'} |`);
    output.push('');
    output.push(`### **Overall Status**: \`${status}\``);
    output.push('');
    if (licenseWarning) {
      output.push(licenseWarning);
      output.push('');
    }
    if (!langMatch && targetLang !== 'Unknown') {
      output.push(`⚠️ **Language Mismatch Warning**: Workspace uses \`${Array.from(detectedLanguages).join(', ')}\` but target uses \`${targetLang}\`. Make sure you can integrate multi-language projects.`);
      output.push('');
    }

    return output.join('\n');
  }

  /**
   * Analyze local directories, detect structural patterns, and compile design recommendations.
   */
  public alignSystemArchitecture(repoName: string, workspacePath: string = '.'): string {
    let validatedPath = '';
    try {
      validatedPath = this.validateWorkspacePath(workspacePath);
    } catch (err: any) {
      console.error(`Workspace validation failed: ${err.message}`);
      return `Error: ${err.message}`;
    }

    const dirsFound = new Set<string>();
    try {
      const files = fs.readdirSync(validatedPath);
      for (const file of files) {
        if (['.git', 'node_modules', '.venv', 'venv', '__pycache__'].includes(file)) {
          continue;
        }
        const fullPath = path.join(validatedPath, file);
        try {
          if (fs.statSync(fullPath).isDirectory()) {
            dirsFound.add(file.toLowerCase());
          }
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      return `Error scanning workspace directories: ${err.message}`;
    }

    const cleanFolders = new Set(['domain', 'ports', 'adapters', 'infrastructure', 'application', 'usecases', 'entities']);
    const mvcFolders = new Set(['models', 'views', 'controllers', 'templates']);
    const layeredFolders = new Set(['services', 'repositories', 'api', 'controllers', 'dao', 'db']);

    let pattern = 'Ad-hoc / Scripting Monolith';
    let description = 'No specific architecture folders detected. Code is organized in ad-hoc modules or scripts.';

    const cleanIntersect = Array.from(cleanFolders).filter((f) => dirsFound.has(f)).length;
    const mvcIntersect = Array.from(mvcFolders).filter((f) => dirsFound.has(f)).length;
    const layeredIntersect = Array.from(layeredFolders).filter((f) => dirsFound.has(f)).length;

    if (cleanIntersect >= 2) {
      pattern = 'Clean / Hexagonal Architecture (Ports & Adapters)';
      description = 'Workspace enforces separation of domain business logic from infrastructure/external libraries using boundaries.';
    } else if (mvcIntersect >= 2) {
      pattern = 'Model-View-Controller (MVC)';
      description = 'Workspace is organized into database models, UI views, and routing/controller components.';
    } else if (layeredIntersect >= 2) {
      pattern = 'Layered Architecture (N-Tier)';
      description = 'Workspace isolates presentation, business services, and database repository layers.';
    }

    const repoLower = repoName.toLowerCase();
    let role = 'Utility Library';

    const dbKeywords = ['db', 'sql', 'redis', 'mongo', 'orm', 'prisma', 'alchemy', 'store', 'postgres'];
    const webKeywords = ['http', 'api', 'flask', 'django', 'express', 'fastapi', 'grpc', 'web', 'route', 'server'];
    const uiKeywords = ['ui', 'component', 'tailwind', 'css', 'react', 'button', 'theme', 'color', 'view'];

    if (dbKeywords.some((kw) => repoLower.includes(kw))) {
      role = 'Database / Storage Layer';
    } else if (webKeywords.some((kw) => repoLower.includes(kw))) {
      role = 'Web API / External Client';
    } else if (uiKeywords.some((kw) => repoLower.includes(kw))) {
      role = 'UI Component / Presentation';
    }

    const advice: string[] = [];
    let diagram = '';

    if (pattern.includes('Clean')) {
      if (['Database / Storage Layer', 'Web API / External Client'].includes(role)) {
        advice.push(`⚠️ **Domain Boundary Alert**: Since the workspace uses Hexagonal/Clean Architecture, do NOT import \`${repoName}\` directly in your core domain/usecase layers.`);
        advice.push(`👉 **Integration Pathway**: Define a Port interface (e.g. \`UserRepository\` or \`APIClient\`) inside your \`domain/ports\` folder. Implement the adapter wrapping \`${repoName}\` in the \`infrastructure/adapters\` directory. Inject it at runtime.`);

        diagram =
          '```mermaid\n' +
          'graph TD\n' +
          '  subgraph Domain Layer\n' +
          '    Usecase[Business Logic/Usecase]\n' +
          '    Port[Port Interface: e.g. IStorage] -->|Defines| Usecase\n' +
          '  end\n' +
          '  subgraph Infrastructure Layer\n' +
          '    Adapter[Adapter Implementation] -->|Implements| Port\n' +
          '    Adapter -->|Calls| Lib["Target Library: ' + repoName + '"]\n' +
          '  end\n' +
          '```';
      } else {
        advice.push(`✅ Core Utility: \`${repoName}\` can be consumed as a standard utility, but keep it isolated if it communicates with outside resources.`);
      }
    } else if (pattern.includes('MVC')) {
      if (role === 'Database / Storage Layer') {
        advice.push(`👉 **Integration Pathway**: Place your database models under the \`models\` folder, and initialize \`${repoName}\` inside a central database configuration file. Ensure controllers do not make raw SQL queries directly.`);
        diagram =
          '```mermaid\n' +
          'graph TD\n' +
          '  Controller[Controller / Router] --> Models[Models Layer]\n' +
          '  Models --> DB["Target Library: ' + repoName + '"]\n' +
          '  Controller --> View[View / Templates]\n' +
          '```';
      } else if (role === 'Web API / External Client') {
        advice.push('👉 **Integration Pathway**: Wrap your API requests in a dedicated controller helper or services folder to keep the core routers thin and testable.');
      } else {
        advice.push(`✅ Standard MVC integration. Import \`${repoName}\` directly inside the layer that requires it (Controller or View).`);
      }
    } else if (pattern.includes('Layered')) {
      if (role === 'Database / Storage Layer') {
        advice.push(`👉 **Integration Pathway**: Integrate \`${repoName}\` strictly in the \`Repository\` or \`DAO\` layer. The \`Service\` and \`API\` layers should only interact with repositories, never with the raw database library.`);
        diagram =
          '```mermaid\n' +
          'graph TD\n' +
          '  API[API Controller Layer] --> Service[Service / Business Layer]\n' +
          '  Service --> Repo[Repository Layer]\n' +
          '  Repo --> Lib["Target Library: ' + repoName + '"]\n' +
          '```';
      } else {
        advice.push(`👉 **Integration Pathway**: Keep \`${repoName}\` usages bounded inside its corresponding layer.`);
      }
    } else {
      advice.push('💡 **Architectural Suggestion**: The workspace doesn\'t have a strict pattern. As the project grows, consider separating business logic from framework-specific code.');
      advice.push(`👉 **Integration Pathway**: Create a helper module or utility folder, and wrap \`${repoName}\` calls inside helper functions rather than distributing them throughout your scripts.`);
      diagram =
        '```mermaid\n' +
        'graph TD\n' +
        '  Main[app.py / main.py] --> Helper[Helper Wrapper Module]\n' +
        '  Helper --> Lib["Target Library: ' + repoName + '"]\n' +
        '```';
    }

    const output: string[] = [];
    output.push(`## 🏛️ Architectural Vector Alignment Report for \`${repoName}\``);
    output.push(`**Workspace Pattern Detected:** \`${pattern}\``);
    output.push(`*${description}*`);
    output.push('');
    output.push(`**Target Library Architectural Role:** \`${role}\``);
    output.push('');
    output.push('### 📌 Integration Recommendations:');
    for (const a of advice) {
      output.push(a);
    }
    output.push('');
    if (diagram) {
      output.push('### 🗺️ Integration Dependency Graph:');
      output.push(diagram);
      output.push('');
    }

    return output.join('\n');
  }
}
