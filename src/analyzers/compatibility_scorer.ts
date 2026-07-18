export const FRAMEWORK_CONFLICTS: Array<[string, string, string, string]> = [
  ['Express', 'Fastify', 'Your workspace is using Express, while this target repository is built around Fastify.', "You can use 'fastify-express' plugin adapter to run Express middleware inside Fastify without rewriting routes."],
  ['Fastify', 'Express', 'Your workspace uses Fastify, while this target repository is designed for Express.', 'Wrap Express handlers inside a standard Node.js request listener or migrate routing middleware.'],
  ['Flask', 'FastAPI', 'Your workspace uses Flask (WSGI synchronous), while this target relies on FastAPI (ASGI asynchronous).', "Use 'a2wsgi' or 'WSGIMiddleware' from 'starlette.middleware.wsgi' to mount your existing Flask app inside FastAPI."],
  ['FastAPI', 'Flask', 'Your workspace uses async FastAPI, while this target repository is structured for Flask.', 'Consider keeping FastAPI as primary and calling Flask routes via WSGI adapter if necessary.'],
  ['React', 'Vue', 'Your workspace uses React, whereas this repository/UI toolkit targets Vue.js.', 'Look for the React equivalent wrapper of this library or use Web Components / Micro-frontend bridges.'],
  ['Vue', 'React', 'Your workspace uses Vue.js, whereas this repository targets React.', "Use 'veaury' or a Vue-to-React component wrapper if embedding is required."],
];

export interface CompatibilityReport {
  score: number;
  level: string;
  color: string;
  conflicts: string[];
  migration_hints: string[];
  summary: string;
}

export function scoreCompatibility(
  workspaceProfile: any,
  targetRepoName: string,
  targetRepoLang: string,
  matchedContext: string = ''
): CompatibilityReport {
  if (!workspaceProfile || workspaceProfile.primary_language === 'Unknown' || !targetRepoLang) {
    return {
      score: 85,
      level: 'Unverified / Generic',
      color: '#A0AEC0',
      conflicts: [],
      migration_hints: ['No specific workspace AST loaded or unknown target language. Standard installation recommended.'],
      summary: 'Workspace profile unverified. Proceed with standard package installation.'
    };
  }

  const userLang = workspaceProfile.primary_language || 'Unknown';
  const userLangs = new Set(workspaceProfile.languages_detected || []);
  const userFrameworks = new Set<string>(workspaceProfile.frameworks_detected || []);
  const userDeps = new Set<string>(workspaceProfile.dependencies || []);

  let score = 100;
  const conflicts: string[] = [];
  const hints: string[] = [];

  // Check if target repo is already in dependencies
  const targetClean = targetRepoName.includes('/') ? targetRepoName.split('/').pop()?.toLowerCase() || '' : targetRepoName.toLowerCase();
  
  if (userDeps.has(targetClean) || Array.from(userFrameworks).some((f) => targetClean.includes(f.toLowerCase()))) {
    return {
      score: 100,
      level: 'Exact Fit (Already Installed)',
      color: '#48BB78', // Green
      conflicts: [],
      migration_hints: [`\`${targetClean}\` is already listed in your workspace dependencies!`],
      summary: `Exact Fit: Your local workspace (\`${workspaceProfile.path}\`) already includes or supports this framework.`
    };
  }

  // Language Compatibility check
  let langCompatible = false;
  if (userLang.toLowerCase() === targetRepoLang.toLowerCase()) {
    langCompatible = true;
  } else if (['JavaScript', 'TypeScript'].includes(userLang) && ['JavaScript', 'TypeScript'].includes(targetRepoLang)) {
    langCompatible = true;
  } else if (userLangs.has(targetRepoLang)) {
    langCompatible = true;
  }

  if (!langCompatible && targetRepoLang !== 'Unknown' && targetRepoLang !== 'All') {
    score -= 40;
    conflicts.push(`Language Mismatch: Your local project is primarily written in **${userLang}**, whereas \`${targetRepoName}\` is a **${targetRepoLang}** repository.`);
    hints.push(`Check if \`${targetRepoName}\` offers a client SDK / REST API or can be run as a standalone Docker microservice alongside your ${userLang} application.`);
  }

  // Framework Conflict check
  for (const [userFw, targetFw, conflictMsg, hintMsg] of FRAMEWORK_CONFLICTS) {
    if (userFrameworks.has(userFw)) {
      if (targetClean.includes(targetFw.toLowerCase()) || (matchedContext && matchedContext.toLowerCase().includes(targetFw.toLowerCase()) && !matchedContext.toLowerCase().includes(userFw.toLowerCase()))) {
        score -= 25;
        conflicts.push(conflictMsg);
        hints.push(hintMsg);
        break;
      }
    }
  }

  score = Math.max(0, Math.min(100, Math.floor(score)));

  let level = 'Exact Fit';
  let color = '#48BB78'; // Green

  if (score >= 85) {
    level = 'Exact Fit';
    color = '#48BB78';
    if (hints.length === 0) {
      const buildTools = workspaceProfile.build_tools || ['pip/npm'];
      hints.push(`Direct integration: Install via your workspace package manager (\`${buildTools.join(' ')}\`).`);
    }
  } else if (score >= 55) {
    level = 'Adapter Needed';
    color = '#ECC94B'; // Yellow
  } else {
    level = 'Stack Mismatch';
    color = '#E53E3E'; // Red
  }

  let summary = '';
  if (conflicts.length === 0) {
    summary = `Good compatibility (${score}% score). Compatible with your ${userLang} stack.`;
  } else {
    summary = `Compatibility score {score}% ({level}). Identified ${conflicts.length} architectural consideration(s).`;
  }

  return {
    score,
    level,
    color,
    conflicts,
    migration_hints: hints,
    summary
  };
}
