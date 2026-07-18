import * as fs from 'fs';
import * as path from 'path';

export interface DiFileDetail {
  file: string;
  di_indicators: number;
  coupled_indicators: number;
  score: number;
}

export interface DiReport {
  workspace_path: string;
  scanned_files: number;
  classes_detected: number;
  di_classes_count: number;
  tightly_coupled_instantiations: number;
  di_score: number;
  di_grade: string;
  details: DiFileDetail[];
  recommendations: string[];
}

export function profileWorkspaceDi(workspacePath: string): DiReport {
  const workspace = path.resolve(workspacePath);

  const report: DiReport = {
    workspace_path: workspace,
    scanned_files: 0,
    classes_detected: 0,
    di_classes_count: 0,
    tightly_coupled_instantiations: 0,
    di_score: 100.0,
    di_grade: 'A',
    details: [],
    recommendations: []
  };

  // RegExp pattern searches
  // TypeScript/JavaScript constructor injection: constructor(private db: DB)
  const tsDiPattern = /constructor\s*\(\s*(?:private|public|protected|readonly)?\s*\w+\s*:\s*\w+/;
  // TS/JS decorators: @inject(), @injectable(), @singleton()
  const decoratorPattern = /@(?:inject|injectable|singleton|service|provide)\b/;
  // Python constructor injection: def __init__(self, db: Database)
  const pyDiPattern = /def\s+__init__\s*\(\s*self\s*,\s*\w+\s*:\s*\w+/;
  // Python direct coupling anti-pattern: self.db = Database()
  const pyTightCoupling = /\bself\.\w+\s*=\s*(?:[A-Z]\w+)\(\)/;

  function walkDir(currentDir: string) {
    let files: string[];
    try {
      files = fs.readdirSync(currentDir);
    } catch {
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
        if (['node_modules', 'venv', '.venv', '.git', '__pycache__', 'chroma_data', 'dist', 'build'].includes(file)) {
          continue;
        }
        walkDir(fullPath);
      } else {
        const ext = path.extname(file).toLowerCase();
        if (!['.py', '.ts', '.tsx', '.js', '.jsx', '.java'].includes(ext)) {
          continue;
        }

        report.scanned_files++;

        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split(/\r?\n/);
          let hasClass = false;
          let diClassSignals = 0;
          let coupledSignals = 0;

          for (const line of lines) {
            if (line.includes('class ')) {
              report.classes_detected++;
              hasClass = true;
            }

            if (decoratorPattern.test(line)) {
              diClassSignals++;
            }
            if (pyDiPattern.test(line) || tsDiPattern.test(line)) {
              diClassSignals++;
            }

            // Check for tightly coupled instantiations (Anti-pattern: new inside body)
            if (pyTightCoupling.test(line) || (line.includes('new ') && !line.includes('class ') && !line.includes('constructor') && line.includes('='))) {
              coupledSignals++;
              report.tightly_coupled_instantiations++;
            }
          }

          if (hasClass) {
            const relPath = path.relative(workspace, fullPath);
            if (diClassSignals > 0) {
              report.di_classes_count++;
            }

            report.details.push({
              file: relPath,
              di_indicators: diClassSignals,
              coupled_indicators: coupledSignals,
              score: Math.max(0.0, 100.0 - coupledSignals * 20.0)
            });
          }
        } catch {
          // ignore
        }
      }
    }
  }

  walkDir(workspace);

  // Calculate DI Score
  const totalClasses = report.classes_detected;
  if (totalClasses > 0) {
    const diRatio = report.di_classes_count / totalClasses;
    report.di_score = 60.0 + diRatio * 40.0;
    report.di_score -= report.tightly_coupled_instantiations * 10.0;
  } else {
    report.di_score = 100.0;
  }

  report.di_score = Math.max(0.0, Math.min(100.0, report.di_score));

  // Assign Grade
  const score = report.di_score;
  if (score >= 90.0) {
    report.di_grade = 'A';
  } else if (score >= 80.0) {
    report.di_grade = 'B';
  } else if (score >= 70.0) {
    report.di_grade = 'C';
  } else if (score >= 60.0) {
    report.di_grade = 'D';
  } else {
    report.di_grade = 'F';
  }

  // Generate recommendations
  if (report.tightly_coupled_instantiations > 0) {
    report.recommendations.push(
      'Decouple direct class constructions. Instead of instantiating helper/adapter modules internally, ' +
        'inject them through constructor parameters to permit unit testing mock boundaries.'
    );
  }
  if (totalClasses > 0 && report.di_classes_count === 0) {
    report.recommendations.push(
      'Adopt standard Dependency Injection containers or factory pattern modules to manage service lifecycles.'
    );
  }
  if (report.recommendations.length === 0) {
    report.recommendations.push('Workspace conforms to high-quality decoupled DI architecture models.');
  }

  return report;
}
