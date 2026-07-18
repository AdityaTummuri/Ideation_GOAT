import * as fs from 'fs';
import * as path from 'path';

export interface VulnerabilityRecord {
  package: string;
  ecosystem: string;
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  details: string;
}

export interface CveReport {
  workspace_path: string;
  packages_scanned: number;
  vulnerabilities_found: VulnerabilityRecord[];
  highest_severity_found: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  gate_triggered: boolean;
  halt_on_severity_threshold: string;
  status: 'PASS' | 'BLOCKED';
}

export async function fetchOsvVulnerabilities(packageName: string, ecosystem: string): Promise<any[]> {
  const url = 'https://api.osv.dev/v1/query';
  const payload = {
    package: {
      name: packageName.toLowerCase(),
      ecosystem
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      const data = (await response.json()) as any;
      return data.vulns || [];
    }
  } catch {
    // ignore
  }
  return [];
}

export function getVulnSeverity(vuln: any): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  // 1. Check for CVSS database metrics
  const severities = vuln.severity || [];
  for (const severityItem of severities) {
    const typeStr = (severityItem.type || '').toUpperCase();
    const scoreStr = severityItem.score || '';
    if (typeStr.includes('CVSS')) {
      try {
        const scoreStrNormal = String(scoreStr);
        const scoreVal = scoreStrNormal.includes('/') ? scoreStrNormal.split('/').pop() : scoreStrNormal;
        const score = parseFloat(scoreVal || '');
        if (!isNaN(score)) {
          if (score >= 9.0) return 'CRITICAL';
          if (score >= 7.0) return 'HIGH';
          if (score >= 4.0) return 'MEDIUM';
          return 'LOW';
        }
      } catch {
        // ignore
      }
    }
  }

  // 2. Check database specific fields
  const dbSpecific = vuln.database_specific || {};
  const sev = (dbSpecific.severity || '').toUpperCase();
  if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(sev)) {
    return sev as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }

  // 3. Default fallback
  return 'MEDIUM';
}

export async function scanWorkspaceSecurityCves(workspacePath: string, haltOnSeverity: string = 'high'): Promise<CveReport> {
  const workspace = path.resolve(workspacePath);
  const report: CveReport = {
    workspace_path: workspace,
    packages_scanned: 0,
    vulnerabilities_found: [],
    highest_severity_found: 'NONE',
    gate_triggered: false,
    halt_on_severity_threshold: haltOnSeverity.toUpperCase(),
    status: 'PASS'
  };

  const dependencies: Array<{ name: string; ecosystem: string }> = [];

  // 1. Parse dependencies from requirements.txt
  const reqTxt = path.join(workspace, 'requirements.txt');
  if (fs.existsSync(reqTxt)) {
    try {
      const content = fs.readFileSync(reqTxt, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const clean = line.trim().split('#')[0];
        if (clean) {
          const pkgMatch = /^([a-zA-Z0-9_\-\[\]]+)/.exec(clean);
          if (pkgMatch) {
            dependencies.push({ name: pkgMatch[1].toLowerCase(), ecosystem: 'PyPI' });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Parse dependencies from package.json
  const pkgJson = path.join(workspace, 'package.json');
  if (fs.existsSync(pkgJson)) {
    try {
      const content = fs.readFileSync(pkgJson, 'utf8');
      const data = JSON.parse(content);
      for (const section of ['dependencies', 'devDependencies']) {
        if (data[section] && typeof data[section] === 'object') {
          for (const dep of Object.keys(data[section])) {
            dependencies.push({ name: dep.toLowerCase(), ecosystem: 'npm' });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Deduplicate dependencies
  const seen = new Set<string>();
  const uniqueDeps: Array<{ name: string; ecosystem: string }> = [];
  for (const dep of dependencies) {
    const key = `${dep.name}:${dep.ecosystem}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueDeps.push(dep);
    }
  }

  report.packages_scanned = uniqueDeps.length;

  const severityRank: Record<string, number> = { 'NONE': 0, 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
  const thresholdRank = severityRank[haltOnSeverity.toUpperCase()] ?? 3; // Default halt on HIGH

  let highestRank = 0;

  // 3. Query OSV.dev for each unique dependency
  for (const dep of uniqueDeps) {
    const vulns = await fetchOsvVulnerabilities(dep.name, dep.ecosystem);
    for (const v of vulns) {
      const vId = v.id || 'Unknown CVE';
      const summary = v.summary || 'No summary provided.';
      const details = v.details || '';
      const sev = getVulnSeverity(v);

      // Record vulnerability
      report.vulnerabilities_found.push({
        package: dep.name,
        ecosystem: dep.ecosystem,
        id: vId,
        severity: sev,
        summary,
        details: details.length > 200 ? `${details.slice(0, 200)}...` : details
      });

      // Check highest severity
      const rank = severityRank[sev] ?? 2;
      if (rank > highestRank) {
        highestRank = rank;
        report.highest_severity_found = sev;
      }

      // Check gate execution halt
      if (rank >= thresholdRank) {
        report.gate_triggered = true;
        report.status = 'BLOCKED';
      }
    }
  }

  return report;
}
