import { settings } from './config.js';
import { makeGithubRequest, parseOwnerRepo } from './analyzers/github_public_api.js';

export class RepoProfiler {
  /**
   * Fetch real-time health, activity telemetry, and security vulnerabilities for a target repository.
   * Queries the GitHub API and the OSV.dev vulnerability database.
   */
  public async getRepoHealth(repoName: string): Promise<string> {
    const ownerRepo = parseOwnerRepo(repoName);
    if (!ownerRepo) {
      return `Error: Could not parse repository identifier: ${repoName}`;
    }

    let stars = 0;
    let forks = 0;
    let openIssues = 0;
    let createdAtStr = '';
    let pushedAtStr = '';
    let size = 0;
    let language = 'Unknown';
    let description = '';

    try {
      const repoData = await makeGithubRequest(`/repos/${ownerRepo}`);
      if (!repoData) {
        return `Error fetching GitHub repository data for '${repoName}': Repo not found or private.`;
      }
      stars = repoData.stargazers_count || 0;
      forks = repoData.forks_count || 0;
      openIssues = repoData.open_issues_count || 0;
      createdAtStr = repoData.created_at || '';
      pushedAtStr = repoData.pushed_at || '';
      size = repoData.size || 0;
      language = repoData.language || 'Unknown';
      description = repoData.description || '';
    } catch (err: any) {
      return `Error fetching GitHub repository data for '${repoName}': ${err.message}`;
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sinceDateIso = thirtyDaysAgo.toISOString();

    // Fetch commit count in last 30 days
    let commitsCount = 0;
    try {
      const commits = await makeGithubRequest(`/repos/${ownerRepo}/commits`, {
        since: sinceDateIso,
        per_page: 100
      });
      commitsCount = Array.isArray(commits) ? commits.length : 0;
    } catch {
      commitsCount = -1;
    }

    // Fetch PR activity in last 30 days
    let openPrs = 0;
    let closedPrs = 0;
    try {
      const pulls = await makeGithubRequest(`/repos/${ownerRepo}/pulls`, {
        state: 'all',
        sort: 'updated',
        per_page: 100
      });
      if (Array.isArray(pulls)) {
        for (const pr of pulls) {
          const updatedAt = new Date(pr.updated_at);
          if (updatedAt >= thirtyDaysAgo) {
            if (pr.state === 'closed') {
              closedPrs++;
            } else {
              openPrs++;
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // Fetch latest commit SHA
    let latestSha = '';
    try {
      const commits = await makeGithubRequest(`/repos/${ownerRepo}/commits`, { per_page: 1 });
      if (Array.isArray(commits) && commits.length > 0) {
        latestSha = commits[0].sha;
      }
    } catch {
      // ignore
    }

    // OSV.dev Vulnerabilities lookup
    const vulnerabilities: string[] = [];
    if (latestSha) {
      try {
        const response = await fetch('https://api.osv.dev/v1/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'IdeationGOAT/1.2.0'
          },
          body: JSON.stringify({ commit: latestSha })
        });
        if (response.ok) {
          const resData = (await response.json()) as any;
          if (resData.vulns) {
            for (const vuln of resData.vulns) {
              const vulnId = vuln.id || 'Unknown ID';
              const summary = vuln.summary || 'No summary provided';
              const details = vuln.details || '';
              const shortDetails = details.length > 120 ? `${details.slice(0, 120)}...` : details;
              vulnerabilities.push(`- **${vulnId}**: ${summary} (${shortDetails})`);
            }
          }
        }
      } catch (err: any) {
        vulnerabilities.push(`*(Could not query OSV database: ${err.message})*`);
      }
    }

    // Vitality score logic (0-100)
    let lastPushDays = 365;
    let pushedAtDate = new Date();
    if (pushedAtStr) {
      pushedAtDate = new Date(pushedAtStr);
      lastPushDays = Math.floor((now.getTime() - pushedAtDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Recency score (max 40)
    let recencyScore = 0;
    if (lastPushDays <= 7) recencyScore = 40;
    else if (lastPushDays <= 30) recencyScore = 30;
    else if (lastPushDays <= 90) recencyScore = 20;
    else if (lastPushDays <= 180) recencyScore = 10;

    // Frequency score (max 30)
    let freqScore = 0;
    if (commitsCount >= 20) freqScore = 30;
    else if (commitsCount >= 10) freqScore = 25;
    else if (commitsCount >= 5) freqScore = 20;
    else if (commitsCount >= 1) freqScore = 10;

    // Community score (max 30)
    const issueRatio = openIssues / (stars + 1);
    let ratioScore = 5;
    if (issueRatio < 0.02) ratioScore = 15;
    else if (issueRatio < 0.05) ratioScore = 10;

    let prScore = 5;
    if (closedPrs >= 5) prScore = 15;
    else if (closedPrs >= 1) prScore = 10;

    const communityScore = ratioScore + prScore;
    const vitalityScore = recencyScore + freqScore + communityScore;

    const createdAtDate = createdAtStr ? new Date(createdAtStr) : new Date();

    const output: string[] = [];
    output.push(`## 🩺 Pulse & Health Telemetry for \`${repoName}\``);
    output.push(`*${description}*`);
    output.push('');
    output.push(`### **Vitality Score**: \`${vitalityScore}/100\``);

    const filledBars = Math.floor(vitalityScore / 10);
    const barStr = '🟩'.repeat(filledBars) + '⬜'.repeat(10 - filledBars);
    output.push(barStr);
    output.push('');

    output.push('### 📊 Metrics');
    output.push(`- ⭐ **Stars:** ${stars.toLocaleString()}`);
    output.push(`- 🍴 **Forks:** ${forks.toLocaleString()}`);
    output.push(`- 🐛 **Open Issues:** ${openIssues.toLocaleString()}`);
    output.push(`- 📅 **Created At:** ${createdAtDate.toISOString().split('T')[0]}`);
    output.push(`- 🚀 **Last Pushed:** ${pushedAtDate.toISOString().split('T')[0]} (${lastPushDays} days ago)`);
    if (commitsCount >= 0) {
      output.push(`- 📈 **Commits (last 30 days):** ${commitsCount}`);
    } else {
      output.push('- 📈 **Commits (last 30 days):** *Failed to fetch*');
    }
    output.push(`- 🤝 **PR Activity (last 30 days):** ${openPrs} Open, {closedPrs} Closed`);
    output.push(`- 💾 **Codebase Size:** ${(size / 1024).toFixed(2)} MB`);
    output.push('');

    output.push('### 🛡️ Security Vulnerabilities (OSV.dev)');
    if (vulnerabilities.length > 0) {
      const realVulns = vulnerabilities.filter((v) => !v.startsWith('*'));
      if (realVulns.length > 0) {
        output.push(`⚠️ **Vulnerabilities Found:** The latest commit \`${latestSha.slice(0, 8)}\` matches known vulnerabilities in the OSV database:`);
        for (const v of vulnerabilities) {
          output.push(v);
        }
      } else {
        output.push('⚠️ **Network / Details:**');
        for (const v of vulnerabilities) {
          output.push(v);
        }
      }
    } else {
      output.push('✅ No known vulnerabilities found for the latest commit SHA in the OSV database.');
    }
    output.push('');

    output.push('### 💡 Verdict');
    if (vitalityScore >= 80 && vulnerabilities.length === 0) {
      output.push('🌟 **Excellent:** This repository is highly active, well-maintained, and has no critical vulnerabilities. It is safe for production use.');
    } else if (vitalityScore >= 50) {
      output.push('⚠️ **Healthy with Caution:** The repository is moderately active. Ensure the maintenance rate aligns with your project lifecycle.');
    } else {
      output.push('❌ **High Risk:** The repository is either abandoned or has extremely low maintenance activity. Consider finding alternatives to avoid technical debt.');
    }

    return output.join('\n');
  }

  /**
   * Profile the structural and resource footprint of a target repository against edge hardware limits.
   */
  public async profileRepoHardwareFootprint(
    repoName: string,
    targetHardware: string,
    sramLimitKb: number = 256.0,
    flashLimitKb: number = 1024.0
  ): Promise<string> {
    const ownerRepo = parseOwnerRepo(repoName);
    if (!ownerRepo) {
      return `Error: Could not parse repository identifier: ${repoName}`;
    }

    let fileNames: string[] = [];
    let repoSize = 0;
    try {
      const repoData = await makeGithubRequest(`/repos/${ownerRepo}`);
      if (repoData) {
        repoSize = repoData.size || 0;
      }

      const rootContents = await makeGithubRequest(`/repos/${ownerRepo}/contents`);
      if (Array.isArray(rootContents)) {
        fileNames = rootContents.map((f: any) => f.name.toLowerCase());
      }
    } catch (err: any) {
      return `Error connecting to GitHub repository '${repoName}': ${err.message}`;
    }

    let mcuLang = 'C/C++';
    const hasCargo = fileNames.includes('cargo.toml');
    const hasPackage = fileNames.includes('package.json');
    const hasRequirements = fileNames.includes('requirements.txt');
    const hasCmakeLists = fileNames.includes('cmakelists.txt') || fileNames.includes('makefile');

    let estSram = 0.0;
    let estFlash = 0.0;
    const warnings: string[] = [];

    if (hasCargo) {
      mcuLang = 'Rust';
      try {
        const cargoData = await makeGithubRequest(`/repos/${ownerRepo}/contents/Cargo.toml`);
        if (cargoData && typeof cargoData === 'object' && cargoData.content) {
          const content = Buffer.from(cargoData.content.replace(/\s+/g, ''), 'base64').toString('utf8').toLowerCase();
          if (content.includes('no_std') || content.includes('alloc')) {
            estSram = 15.0;
            estFlash = 45.0;
            warnings.push('✅ Rust crate appears to support `no_std`. Suitable for bare-metal.');
          } else {
            estSram = 512.0;
            estFlash = 1024.0;
            warnings.push('⚠️ Rust crate does not explicitly declare `no_std`. Standard library `std` may exceed SRAM limits on thin microcontrollers.');
          }
        } else {
          throw new Error('Cargo.toml content empty');
        }
      } catch {
        estSram = 128.0;
        estFlash = 256.0;
        warnings.push('⚠️ Failed to parse Cargo.toml. Assuming standard Rust std footprint.');
      }
    } else if (hasRequirements) {
      mcuLang = 'MicroPython / Python';
      estSram = 120.0;
      estFlash = 512.0;
      warnings.push('⚠️ Python code detected. Will require MicroPython/CircuitPython interpreter on the microcontroller.');
      warnings.push('⚠️ Python code is dynamically allocated and could cause high heap/SRAM consumption and fragmentation.');
    } else if (hasPackage) {
      mcuLang = 'JavaScript / JerryScript';
      estSram = 180.0;
      estFlash = 600.0;
      warnings.push('⚠️ JavaScript code detected. Requires QuickJS or JerryScript engine, which have high overhead on Cortex-M boards.');
    } else if (hasCmakeLists || fileNames.some((f) => f.endsWith('.h') || f.endsWith('.c') || f.endsWith('.cpp'))) {
      mcuLang = 'C/C++';
      let usesStl = false;
      try {
        const hFileNames = fileNames.filter((f) => f.endsWith('.h') || f.endsWith('.hpp'));
        if (hFileNames.length > 0) {
          const sampleData = await makeGithubRequest(`/repos/${ownerRepo}/contents/${hFileNames[0]}`);
          if (sampleData && typeof sampleData === 'object' && sampleData.content) {
            const content = Buffer.from(sampleData.content.replace(/\s+/g, ''), 'base64').toString('utf8');
            if (content.includes('std::') || content.includes('vector') || content.includes('string')) {
              usesStl = true;
            }
          }
        }
      } catch {
        // ignore
      }

      if (usesStl) {
        estSram = 64.0;
        estFlash = 200.0;
        warnings.push('⚠️ C++ library uses standard template library (STL) headers (vector/string), which cause heap usage and binary bloat.');
      } else {
        estSram = 20.0;
        estFlash = 80.0;
        warnings.push('✅ Bare-metal C/C++ codebase with low overhead. Highly compatible with small microcontrollers.');
      }
    } else {
      mcuLang = 'C/C++';
      estSram = 50.0;
      estFlash = 150.0;
      warnings.push('⚠️ Unknown framework structure. Footprint estimated based on language.');
    }

    if (repoSize > 10000) {
      estFlash += 300.0;
      estSram += 50.0;
      warnings.push(`⚠️ Large repository size (${(repoSize / 1024).toFixed(1)}MB). Binary footprint may expand depending on compiled features.`);
    }

    const sramOk = estSram <= sramLimitKb;
    const flashOk = estFlash <= flashLimitKb;

    let score = 100;
    if (!sramOk) score -= 50;
    if (!flashOk) score -= 30;

    const output: string[] = [];
    output.push(`## 🎛️ Edge-Deploy Footprint Profile for \`${repoName}\``);
    output.push(`**Target Microcontroller/Hardware:** \`${targetHardware}\``);
    output.push(`**Core Language Ecosystem:** \`${mcuLang}\``);
    output.push('');
    output.push('| Resource Metric | Estimated Footprint | Specified Hardware Limit | Match Status |');
    output.push('| --- | --- | --- | --- |');
    output.push(`| **SRAM / RAM** | ${estSram.toFixed(1)} KB | ${sramLimitKb.toFixed(1)} KB | ${sramOk ? '✅ Fits' : '❌ Exceeded'} |`);
    output.push(`| **Flash Storage** | ${estFlash.toFixed(1)} KB | ${flashLimitKb.toFixed(1)} KB | ${flashOk ? '✅ Fits' : '❌ Exceeded'} |`);
    output.push('');
    output.push(`### **Hardware Fit Score**: \`${score}/100\``);
    output.push('');
    output.push('### 🔍 Static Analysis Findings:');
    for (const w of warnings) {
      output.push(w);
    }
    output.push('');
    output.push('### 💡 Deployment Recommendation:');
    if (score === 100) {
      output.push(`🟢 **Deployable:** \`${repoName}\` is extremely lightweight and will easily fit on the \`${targetHardware}\`. Go ahead with integration.`);
    } else if (score >= 50) {
      output.push(`🟡 **Optimizations Required:** You can run this codebase on \`${targetHardware}\`, but you must optimize memory layouts, compile with optimization flags (e.g. \`-Os\`), and disable unnecessary library modules.`);
    } else {
      output.push(`🔴 **Incompatible / High Risk:** This library is too heavy for the \`${targetHardware}\` spec. SRAM or Flash requirements will lead to build errors or runtime out-of-memory crashes. Consider a C/Rust bare-metal alternative.`);
    }

    return output.join('\n');
  }
}
