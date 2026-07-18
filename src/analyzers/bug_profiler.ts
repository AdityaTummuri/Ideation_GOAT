import { makeGithubRequest, parseOwnerRepo } from './github_public_api.js';

export const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from',
  'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'not', 'no', 'can', 'could', 'should', 'would',
  'will', 'just', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'than', 'that', 'this', 'these', 'those', 'it', 'its',
  'of', 'error', 'bug', 'issue', 'fails', 'failed', 'when', 'using', 'use', 'doesnt', 'work',
  'not', 'working'
]);

export const HIGH_SEVERITY_KEYWORDS = new Set([
  'crash', 'crashes', 'crashing', 'leak', 'memory', 'deadlock', 'drop', 'dropped', 'drops',
  'disconnect', 'security', 'vulnerability', 'fatal', 'panic', 'corrupt', 'corruption',
  'freeze', 'freezes', 'unresponsive', 'oom', 'segfault'
]);

export interface Pitfall {
  label: string;
  percentage: number;
  count: number;
  example_issues: string[];
  is_critical: boolean;
}

export interface BugReport {
  repo?: string;
  total_analyzed_issues: number;
  top_pitfalls: Pitfall[];
  risk_level: 'Low' | 'Moderate' | 'High' | 'Unknown';
  error?: string;
  message?: string;
}

function cleanTitle(title: string): string[] {
  // Remove code blocks, brackets, tags like [Bug], (v2.0)
  const cleaned = title.toLowerCase().replace(/\[.*?\]|\(.*?\)/g, ' ');
  const words = cleaned.match(/[a-z0-9_-]+/g) || [];
  return words.filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

function fallbackKeywordClustering(titles: string[]): Pitfall[] {
  const total = titles.length;
  if (total === 0) return [];

  // Count meaningful keyword occurrences
  const keywordMap: Record<string, number> = {};
  const titleWordsList: Array<{ title: string; words: string[] }> = [];

  for (const t of titles) {
    const words = cleanTitle(t);
    titleWordsList.push({ title: t, words });
    
    // Deduplicate words in the same title to count document frequency
    const uniqueWords = Array.from(new Set(words));
    for (const w of uniqueWords) {
      keywordMap[w] = (keywordMap[w] || 0) + 1;
    }
  }

  // Find top 5 dominant keywords
  const topKeywords = Object.entries(keywordMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((entry) => entry[0]);

  const clusters: Pitfall[] = [];
  const usedIndices = new Set<number>();

  for (const kw of topKeywords) {
    const matchingTitles: string[] = [];
    for (let idx = 0; idx < titleWordsList.length; idx++) {
      if (!usedIndices.has(idx) && titleWordsList[idx].words.includes(kw)) {
        matchingTitles.push(titleWordsList[idx].title);
        usedIndices.add(idx);
      }
    }

    if (matchingTitles.length > 0) {
      const pct = parseFloat(((matchingTitles.length / total) * 100).toFixed(1));
      
      // Find a second co-occurring word for a better label
      const coWords: Record<string, number> = {};
      for (const t of matchingTitles) {
        for (const w of cleanTitle(t)) {
          if (w !== kw) {
            coWords[w] = (coWords[w] || 0) + 1;
          }
        }
      }

      const sortedCoWords = Object.entries(coWords).sort((a, b) => b[1] - a[1]);
      const secondWord = sortedCoWords.length > 0 ? ` / ${sortedCoWords[0][0]}` : '';
      const label = `${kw.charAt(0).toUpperCase() + kw.slice(1)}${secondWord} issues`;

      const isCritical = Array.from(HIGH_SEVERITY_KEYWORDS).some((h) => kw.includes(h) || label.toLowerCase().includes(h)) || pct >= 20.0;

      clusters.push({
        label,
        percentage: pct,
        count: matchingTitles.length,
        example_issues: matchingTitles.slice(0, 2),
        is_critical: isCritical
      });
    }

    if (clusters.length >= 3) {
      break;
    }
  }

  return clusters.sort((a, b) => b.percentage - a.percentage);
}

export async function analyzeRepoBugs(repoNameOrUrl: string): Promise<BugReport> {
  const ownerRepo = parseOwnerRepo(repoNameOrUrl);
  if (!ownerRepo) {
    return {
      total_analyzed_issues: 0,
      top_pitfalls: [],
      risk_level: 'Unknown',
      error: 'Could not parse repository identifier.'
    };
  }

  // Fetch issues with label 'bug' first
  let issues = await makeGithubRequest(`/repos/${ownerRepo}/issues`, { state: 'all', labels: 'bug', per_page: 80 });

  // If few bug-labeled issues, fetch general open issues
  if (!issues || !Array.isArray(issues) || issues.length < 10) {
    const generalIssues = await makeGithubRequest(`/repos/${ownerRepo}/issues`, { state: 'open', per_page: 80 });
    if (Array.isArray(generalIssues)) {
      issues = [...(Array.isArray(issues) ? issues : []), ...generalIssues];
    }
  }

  if (!issues || !Array.isArray(issues) || issues.length === 0) {
    return {
      repo: ownerRepo,
      total_analyzed_issues: 0,
      top_pitfalls: [],
      risk_level: 'Low',
      message: 'No recent issues found.'
    };
  }

  // Filter out pull requests (GitHub API returns PRs inside issues endpoint)
  const cleanIssues = issues.filter((i) => !('pull_request' in i));
  const titles = cleanIssues.map((i) => i.title).filter((t) => typeof t === 'string' && t.trim() !== '');

  if (titles.length === 0) {
    return {
      repo: ownerRepo,
      total_analyzed_issues: 0,
      top_pitfalls: [],
      risk_level: 'Low',
      message: 'No valid issue titles analyzed.'
    };
  }

  const pitfalls = fallbackKeywordClustering(titles);

  // Determine overall bug risk level
  let riskLevel: 'Low' | 'Moderate' | 'High' | 'Unknown' = 'Low';
  if (pitfalls.some((p) => p.is_critical && p.percentage >= 20.0)) {
    riskLevel = 'High';
  } else if (pitfalls.some((p) => p.percentage >= 15.0)) {
    riskLevel = 'Moderate';
  }

  return {
    repo: ownerRepo,
    total_analyzed_issues: titles.length,
    top_pitfalls: pitfalls,
    risk_level: riskLevel
  };
}
