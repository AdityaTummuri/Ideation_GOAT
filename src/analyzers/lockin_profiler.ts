import { makeGithubRequest, parseOwnerRepo } from './github_public_api.js';

export const VENDOR_PATTERNS: Array<[RegExp, string, string]> = [
  [/^@aws-sdk\/.*|^aws-sdk$|^boto3$|^botocore$|^aws-cdk.*|^aws-amplify$|^serverless$/i, 'Amazon Web Services (AWS)', 'Direct AWS SDK or serverless cloud adapter.'],
  [/^@vercel\/.*|^vercel$|^@edge-runtime\/.*/i, 'Vercel Cloud', 'Vercel-specific cloud edge or hosting SDK.'],
  [/^@google-cloud\/.*|^google-cloud-.*|^firebase$|^firebase-admin$/i, 'Google Cloud Platform / Firebase', 'GCP or Firebase proprietary backend adapter.'],
  [/^@azure\/.*|^azure-.*/i, 'Microsoft Azure', 'Direct Azure cloud SDK or function adapter.'],
  [/^wrangler$|^@cloudflare\/.*/i, 'Cloudflare Workers', 'Cloudflare Edge/Worker specific runtime dependency.'],
  [/^@supabase\/.*|^supabase$/i, 'Supabase Cloud', 'Supabase proprietary BaaS client SDK (Self-hostable with effort).'],
];

export interface LockedDependency {
  package: string;
  vendor: string;
  reason: string;
}

export interface LockinReport {
  repo?: string;
  portability_grade: string;
  grade_color: string;
  total_dependencies_checked: number;
  locked_dependencies: LockedDependency[];
  summary: string;
}

async function fetchFileContent(ownerRepo: string, filepath: string): Promise<string> {
  const data = await makeGithubRequest(`/repos/${ownerRepo}/contents/${filepath}`);
  if (data && typeof data === 'object' && 'content' in data) {
    try {
      const b64 = data.content.replace(/\s+/g, '');
      return Buffer.from(b64, 'base64').toString('utf8');
    } catch {
      // ignore
    }
  }
  return '';
}

async function parseDependencies(ownerRepo: string): Promise<string[]> {
  const deps = new Set<string>();

  // Check package.json
  const pkgJsonContent = await fetchFileContent(ownerRepo, 'package.json');
  if (pkgJsonContent) {
    try {
      const parsed = JSON.parse(pkgJsonContent);
      for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
        if (parsed[section] && typeof parsed[section] === 'object') {
          for (const key of Object.keys(parsed[section])) {
            deps.add(key);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Check requirements.txt
  const reqTxtContent = await fetchFileContent(ownerRepo, 'requirements.txt');
  if (reqTxtContent) {
    const lines = reqTxtContent.split(/\r?\n/);
    for (const line of lines) {
      const clean = line.trim().split('#')[0];
      if (clean) {
        const pkgMatch = /^([a-zA-Z0-9_\-\[\]]+)/.exec(clean);
        if (pkgMatch) {
          deps.add(pkgMatch[1]);
        }
      }
    }
  }

  // Check pyproject.toml
  const pyprojectContent = await fetchFileContent(ownerRepo, 'pyproject.toml');
  if (pyprojectContent) {
    const regex = /["']([a-zA-Z0-9_-]+)(?:[=<>~!].*?)?["']/g;
    let match;
    while ((match = regex.exec(pyprojectContent)) !== null) {
      const m = match[1];
      if (!['python', 'poetry', 'setuptools', 'wheel'].includes(m)) {
        deps.add(m);
      }
    }
  }

  return Array.from(deps);
}

export async function checkEcosystemLockin(repoNameOrUrl: string): Promise<LockinReport> {
  const ownerRepo = parseOwnerRepo(repoNameOrUrl);
  if (!ownerRepo) {
    return {
      portability_grade: 'Unknown',
      grade_color: '#A0AEC0',
      total_dependencies_checked: 0,
      locked_dependencies: [],
      summary: 'Could not parse repository identifier.'
    };
  }

  const dependencies = await parseDependencies(ownerRepo);
  const lockedDeps: LockedDependency[] = [];

  for (const dep of dependencies) {
    for (const [pattern, vendor, reason] of VENDOR_PATTERNS) {
      if (pattern.test(dep)) {
        lockedDeps.push({
          package: dep,
          vendor,
          reason
        });
        break;
      }
    }
  }

  // Determine Grade
  const count = lockedDeps.length;
  let grade = 'A';
  let color = '#48BB78'; // Green
  let summary = '';

  if (count === 0) {
    grade = 'A';
    color = '#48BB78';
    summary = 'This framework earns a Grade A for portability. It imports no proprietary cloud or serverless adapters, meaning it can run on any Linux, Docker, or self-hosted environment.';
  } else if (count === 1) {
    grade = 'B';
    color = '#ECC94B'; // Yellow
    summary = `This framework earns a Grade B for portability. It includes 1 cloud adapter (${lockedDeps[0].package} for ${lockedDeps[0].vendor}), which is minor and usually replaceable.`;
  } else if (count <= 3) {
    grade = 'C';
    color = '#ED8936'; // Orange
    const vendors = Array.from(new Set(lockedDeps.map((d) => d.vendor))).join(', ');
    summary = `This framework earns a Grade C for portability. It heavily imports proprietary cloud SDKs (${vendors}), meaning migrating to a self-hosted environment later will require architectural refactoring.`;
  } else {
    grade = 'D';
    color = '#E53E3E'; // Red
    const vendors = Array.from(new Set(lockedDeps.map((d) => d.vendor))).join(', ');
    summary = `This framework earns a Grade D for portability. It has extensive proprietary cloud dependencies (${count} packages tied to ${vendors}). It is deeply locked into this specific cloud ecosystem.`;
  }

  return {
    repo: ownerRepo,
    portability_grade: grade,
    grade_color: color,
    total_dependencies_checked: dependencies.length,
    locked_dependencies: lockedDeps,
    summary
  };
}
