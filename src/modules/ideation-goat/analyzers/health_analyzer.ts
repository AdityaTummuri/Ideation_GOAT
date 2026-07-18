import { makeGithubRequest, parseOwnerRepo } from './github_public_api.js';

export interface HealthReport {
  health_score: number;
  status: 'Healthy' | 'Caution' | 'High Risk';
  flags: string[];
  metrics: {
    repo?: string;
    stars?: number;
    cve_count?: number;
    last_commit_date?: string;
    contributors_count?: number;
    archived?: boolean;
    language?: string;
  };
}

export async function queryOsvVulnerabilities(packageName: string, language: string): Promise<any[]> {
  const ecosystemMap: Record<string, string> = {
    'python': 'PyPI',
    'javascript': 'npm',
    'typescript': 'npm',
    'rust': 'crates.io',
    'go': 'Go'
  };
  const ecosystem = ecosystemMap[language.toLowerCase()];
  if (!ecosystem) {
    return [];
  }

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
  } catch (err: any) {
    console.warn(`[DEBUG] OSV query failed for ${packageName}: ${err.message}`);
  }
  return [];
}

export async function analyzeRepoHealth(repoNameOrUrl: string): Promise<HealthReport> {
  const ownerRepo = parseOwnerRepo(repoNameOrUrl);
  if (!ownerRepo) {
    return {
      health_score: 0,
      status: 'High Risk',
      flags: ['INVALID_REPO: Could not parse repository identifier.'],
      metrics: {}
    };
  }

  // Fetch basic repo metadata
  const repoData = await makeGithubRequest(`/repos/${ownerRepo}`);
  if (!repoData) {
    return {
      health_score: 50,
      status: 'Caution',
      flags: ['UNVERIFIED: Could not fetch GitHub repository metadata.'],
      metrics: { repo: ownerRepo }
    };
  }

  const archived = repoData.archived || false;
  const language = repoData.language || 'Unknown';
  const stars = repoData.stargazers_count || 0;
  const pushedAtStr = repoData.pushed_at;

  // Check contributors count
  const contributors = await makeGithubRequest(`/repos/${ownerRepo}/contributors`, { per_page: 10 });
  const contributorsCount = Array.isArray(contributors) ? contributors.length : 1;

  // Check recent commit / push date
  let monthsInactive = 0;
  let lastCommitDate = 'Unknown';
  if (pushedAtStr) {
    try {
      const pushedDt = new Date(pushedAtStr);
      const now = new Date();
      const daysInactive = Math.floor((now.getTime() - pushedDt.getTime()) / (1000 * 60 * 60 * 24));
      monthsInactive = daysInactive / 30.44;
      lastCommitDate = pushedDt.toISOString().split('T')[0];
    } catch {
      // ignore
    }
  }

  // Query OSV for known vulnerabilities (using repo name)
  const packageName = ownerRepo.split('/').pop() || '';
  const vulns = await queryOsvVulnerabilities(packageName, language);
  const cveCount = vulns.length;

  // Calculate composite health score (0 to 100)
  let score = 100;
  const flags: string[] = [];

  if (archived) {
    score = 0;
    flags.push('ABANDONED: Repository is officially archived by its maintainers.');
  } else {
    // Penalize inactivity
    if (monthsInactive > 18) {
      score -= 40;
      flags.push(`STALE: No updates in over 18 months (Last commit: ${lastCommitDate}).`);
    } else if (monthsInactive > 12) {
      score -= 25;
      flags.push(`STALE: No updates in over a year (Last commit: ${lastCommitDate}).`);
    } else if (monthsInactive > 6) {
      score -= 10;
      flags.push(`INACTIVE: No updates in ${Math.floor(monthsInactive)} months.`);
    }

    // Penalize low bus factor / contributor count
    if (contributorsCount <= 1) {
      score -= 15;
      flags.push('BUS_FACTOR_RISK: Maintained by a single contributor.');
    } else if (contributorsCount <= 2) {
      score -= 5;
    }

    // Penalize CVEs
    if (cveCount > 0) {
      const penalty = Math.min(cveCount * 20, 60);
      score -= penalty;
      flags.push(`CVE_CRITICAL: Found ${cveCount} known security vulnerability report(s) on OSV.dev.`);
    }
  }

  score = Math.max(0, Math.min(100, Math.floor(score)));

  let status: 'Healthy' | 'Caution' | 'High Risk' = 'Healthy';
  if (score >= 80) {
    status = 'Healthy';
  } else if (score >= 50) {
    status = 'Caution';
  } else {
    status = 'High Risk';
  }

  return {
    health_score: score,
    status,
    flags,
    metrics: {
      repo: ownerRepo,
      stars,
      cve_count: cveCount,
      last_commit_date: lastCommitDate,
      contributors_count: contributorsCount,
      archived,
      language
    }
  };
}
