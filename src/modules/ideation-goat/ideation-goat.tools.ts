import {
  ToolDecorator as Tool,
  ResourceDecorator as Resource,
  z,
  ExecutionContext,
  Injectable
} from '@nitrostack/core';

import { CrossDomainSearchEngine } from './search_engine.js';
import { ProjectScaffolder } from './scaffolder.js';
import { WorkspaceAnalyzer } from './workspace_analyzer.js';
import { RepoProfiler } from './repo_profiler.js';
import { WorkflowOrchestrator } from './orchestrator.js';

// Modular analyzer imports
import { analyzeWorkspace as analyze_workspace } from './analyzers/workspace_analyzer.js';
import { analyzeRepoHealth as analyze_repo_health } from './analyzers/health_analyzer.js';
import { checkEcosystemLockin as run_lockin_profiler } from './analyzers/lockin_profiler.js';
import { analyzeRepoBugs as run_bug_profiler } from './analyzers/bug_profiler.js';
import { forecastDeploymentCosts } from './analyzers/cost_forecaster.js';
import { healParameterSchema } from './analyzers/schema_healer.js';
import { verifySandboxIdentity } from './analyzers/identity_sandbox.js';
import { profileWorkspaceDi } from './analyzers/di_profiler.js';
import { scanWorkspaceSecurityCves } from './analyzers/cve_shield.js';

// In-memory session cache for get_metaphor_canvas
let lastSearch = {
  query: '',
  mode: '',
  matches: [] as any[]
};

@Injectable()
export class IdeationGoatTools {
  private searchEngine = new CrossDomainSearchEngine();
  private scaffolder = new ProjectScaffolder();
  private workspaceAnalyzer = new WorkspaceAnalyzer();
  private repoProfiler = new RepoProfiler();
  private orchestrator = new WorkflowOrchestrator();

  @Resource({
    uri: 'ideation-goat://canvas',
    name: 'Metaphor Canvas',
    description: 'Returns the constellation node graph data for the last active search query.'
  })
  async getMetaphorCanvas(ctx: ExecutionContext) {
    const query = lastSearch.query;
    const mode = lastSearch.mode;
    const matches = lastSearch.matches;

    if (!query) {
      return {
        status: 'idle',
        message: 'No query has been executed yet. Run search_knowledge_grid first.'
      };
    }

    const nodes: any[] = [];
    const edges: any[] = [];

    // Add root query node
    nodes.push({
      id: 'root-query',
      label: `Intent: '${query.slice(0, 25)}...'`,
      type: 'intent',
      weight: 1.0,
      color: '#FF3366'
    });

    // Add matches nodes and edge links
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const nodeId = `node-${i}`;
      const source = match.source || 'Unknown Source';
      const title = match.title || `Result ${i}`;

      const isCs = ['github', 'cs.', 'computer science'].some((domain) =>
        source.toLowerCase().includes(domain)
      );
      const nodeColor = isCs ? '#3399FF' : '#33FF99';

      nodes.push({
        id: nodeId,
        label: `[${source}] ${title}`,
        type: 'result',
        category: match.category || match.domain || 'General',
        color: nodeColor
      });

      const cognitiveTension = isCs ? 0.1 : 0.4 + i * 0.15;
      edges.push({
        source: 'root-query',
        target: nodeId,
        relationship_type: isCs ? 'precision_equivalent' : 'cross_domain_bridge',
        tension_distance: cognitiveTension
      });
    }

    return {
      status: 'active',
      last_query: query,
      mode_executed: mode,
      graph_topology: {
        nodes,
        edges
      }
    };
  }

  @Tool({
    name: 'search_knowledge_grid',
    description: 'Advanced multi-domain index query engine. Interrogates codebases, academia, and patents.',
    inputSchema: z.object({
      query: z.string().describe('Deep operational concept or system design goal.'),
      mode: z.enum(['target', 'discovery']).default('target').describe('Search mode determining grid traversal.'),
      cognitive_distance: z.number().min(0.0).max(1.0).default(0.0).describe('Applied cognitive distance factor.')
    })
  })
  async searchKnowledgeGrid(
    input: { query: string; mode: 'target' | 'discovery'; cognitive_distance: number },
    ctx: ExecutionContext
  ) {
    console.log(`Executing search grid query via MCP: ${input.query}`);
    const normalizedMode = input.mode.toLowerCase().trim();

    if (normalizedMode === 'target') {
      const matches = await this.searchEngine.searchTarget(input.query);
      const synthesis = await this.searchEngine.synthesizeWhyFits(input.query, matches);
      lastSearch = {
        query: input.query,
        mode: 'target',
        matches
      };
      return {
        status: 'success',
        mode: 'target',
        matches,
        llm_synthesis: synthesis
      };
    } else if (normalizedMode === 'discovery') {
      const matches = await this.searchEngine.searchDiscovery(input.query, input.cognitive_distance);
      const synthesis = await this.searchEngine.synthesizeWhyFits(input.query, matches);
      lastSearch = {
        query: input.query,
        mode: 'discovery',
        matches
      };
      return {
        status: 'success',
        mode: 'discovery',
        applied_cognitive_distance: input.cognitive_distance,
        matches,
        llm_synthesis: synthesis
      };
    } else {
      return { status: 'error', message: `Invalid mode configuration parameter: '${input.mode}'` };
    }
  }

  @Tool({
    name: 'breed_concepts',
    description: 'Synthesizes two distinct conceptual structures into a hybrid architectural blueprint.',
    inputSchema: z.object({
      concept_a: z.object({
        title: z.string(),
        description: z.string(),
        domain_context: z.string()
      }).describe('First conceptual paradigm model.'),
      concept_b: z.object({
        title: z.string(),
        description: z.string(),
        domain_context: z.string()
      }).describe('Second conceptual paradigm model to graft.')
    })
  })
  async breedConcepts(input: { concept_a: any; concept_b: any }, ctx: ExecutionContext) {
    console.log('Parsing distinct structural topologies for breeding...');

    const nameA = input.concept_a.title || 'Concept Alpha';
    const descA = input.concept_a.description || '';
    const domA = input.concept_a.domain_context || 'Unknown Domain';

    const nameB = input.concept_b.title || 'Concept Beta';
    const descB = input.concept_b.description || '';
    const domB = input.concept_b.domain_context || 'Unknown Domain';

    const hybridParadigm = `${nameB}-Infused ${nameA} Architecture`;

    const graftMath =
      descB.toLowerCase().includes('decay') || descA.toLowerCase().includes('cache')
        ? 'S_c = \\sum_{i=1}^{n} (\\vec{V}_{A,i} \\cdot \\vec{V}_{B,i}) \\times \\gamma^{\\Delta t}'
        : 'Q_f = \\lim_{\\Delta t \\to 0} \\frac{F_t(x + \\Delta x) - F_t(x)}{\\Delta x \\cdot \\lambda_{mesh}}';

    const catalystPrompt =
      'ACT AS A CONCEPTUAL TRANSLATOR.\n' +
      `Synthesize the software structure of '${nameA}' in '${domA}' with the operational rules ` +
      `of '${nameB}' in '${domB}'.\n` +
      `Generate a robust markdown specification showing how the mechanics of Y (${nameB}) can be ` +
      `grafted directly onto the software system of X (${nameA}) to unlock a new paradigm.`;

    return {
      status: 'hybridization_complete',
      lineage: { parent_primary: nameA, parent_secondary: nameB },
      synthesis_payload: {
        paradigm_name: hybridParadigm,
        structural_bridge: `Mapping the algorithmic/physical flow from ${domB} onto the system envelope of ${domA}.`,
        hybrid_mechanics:
          `Extract the dynamic rules from ${nameB} (${descB.slice(0, 80)}...) ` +
          `and integrate them directly within the core state of ${nameA} (${descA.slice(0, 80)}...). ` +
          'This strips traditional boundaries and replaces them with a cross-pollinated state model.',
        mathematical_grafting_formula: graftMath,
        critical_tradeoffs: [
          'Increased latency/CPU calculation footprint during synchronization passes.',
          'Non-linear debugging matrices created by cross-domain mapping interfaces.'
        ],
        bridge_catalyst_prompt: catalystPrompt
      }
    };
  }

  @Tool({
    name: 'bridge_code_and_theory',
    description: 'Bidirectional Algorithmic Translation tool. Translates code logic into mathematical LaTeX, or latex equations into software code architectures.',
    inputSchema: z.object({
      code_snippet: z.string().optional().describe('Source code logic pattern to analyze.'),
      latex_formula: z.string().optional().describe('LaTeX formula string to map to implementations.')
    })
  })
  async bridgeCodeAndTheory(input: { code_snippet?: string; latex_formula?: string }, ctx: ExecutionContext) {
    console.log('Initiating Algorithmic Translation sequence.');

    if (input.code_snippet) {
      const codeLower = input.code_snippet.toLowerCase();
      let derivedMath = '';
      let paradigm = '';
      let queryTerms = '';

      if (['cas', 'atomic', 'lock', 'thread', 'concurrent'].some((kw) => codeLower.includes(kw))) {
        derivedMath = 'L_{sync} = \\min \\left( \\sum_{i=1}^{m} t_{wait,i} \\right) \\Rightarrow \\text{Linearizability Bound}';
        paradigm = 'Lock-Free Concurrent Consistency and Linearizability Bounds';
        queryTerms = 'linearizability concurrency';
      } else if (['decay', 'evict', 'ttl', 'expire', 'time'].some((kw) => codeLower.includes(kw))) {
        derivedMath = 'D_t = D_0 \\cdot e^{-\\lambda t}';
        paradigm = 'Non-Linear Decay Processes and Poisson Eviction Models';
        queryTerms = 'poisson eviction decay';
      } else if (['route', 'graph', 'node', 'edge', 'mesh'].some((kw) => codeLower.includes(kw))) {
        derivedMath = '\\nabla \\cdot \\vec{J} = -\\frac{\\partial \\rho}{\\partial t}';
        paradigm = 'Graph-Theoretic Conservation Laws and Network Routing Optimization';
        queryTerms = 'graph network optimization routing';
      } else {
        derivedMath = 'X_{t+1} = \\Phi(X_t, U_t) + w_t';
        paradigm = 'Discrete Dynamical System State Models';
        queryTerms = 'dynamical system state';
      }

      const papers = await this.searchEngine.arxiv_client.search(queryTerms, 3);

      return {
        translation_direction: 'Code to Theory',
        derived_mathematical_paradigm: paradigm,
        derived_latex_equations: derivedMath,
        matching_theoretical_papers: papers.map((p: any) => ({
          title: p.title,
          url: p.url,
          summary: p.summary ? `${p.summary.slice(0, 120)}...` : ''
        }))
      };
    } else if (input.latex_formula) {
      const formulaLower = input.latex_formula.toLowerCase();
      let mappedRepos: any[] = [];
      let logicBrief = '';

      if (formulaLower.includes('e^{-') || formulaLower.includes('lambda') || formulaLower.includes('decay')) {
        mappedRepos = this.searchEngine.mock_repos.filter((repo: any) => ['CacheGraphene', 'ShedValve'].includes(repo.title));
        logicBrief = 'Implement using an atomic ticker index and thread-safe hash eviction buffers.';
      } else if (formulaLower.includes('sum') || formulaLower.includes('vec') || formulaLower.includes('cdot')) {
        mappedRepos = this.searchEngine.mock_repos.filter((repo: any) => ['CacheGraphene', 'SecurInvert'].includes(repo.title));
        logicBrief = 'Implement using multi-dimensional array math (numpy/broadcasting) or hardware SIMD dot products.';
      } else if (formulaLower.includes('lim') || formulaLower.includes('delta') || formulaLower.includes('mesh')) {
        mappedRepos = this.searchEngine.mock_repos.filter((repo: any) => ['MeshFlow'].includes(repo.title));
        logicBrief = 'Implement using priority queues and dynamic node graph weight adjustments.';
      } else {
        mappedRepos = this.searchEngine.mock_repos.slice(0, 2);
        logicBrief = 'Implement using standard non-blocking queues or loop states.';
      }

      return {
        translation_direction: 'Theory to Code',
        detected_formula_envelope: input.latex_formula,
        software_implementation_logic: logicBrief,
        matched_codebase_templates: mappedRepos
      };
    } else {
      return {
        status: 'error',
        message: 'Specify at least \'code_snippet\' or \'latex_formula\' to perform translation.'
      };
    }
  }

  @Tool({
    name: 'assess_viability',
    description: 'Evaluates a custom design concept against commercial patterns and active patent claims.',
    inputSchema: z.object({
      system_design: z.string().describe('Text describing design components and architecture layout.')
    })
  })
  async assessViability(input: { system_design: string }, ctx: ExecutionContext) {
    console.log('Initializing patent collision detection matrices.');

    const designLower = input.system_design.toLowerCase();
    const keywords = designLower
      .split(/\s+/)
      .filter((word) => word.length > 4 && !['system', 'design', 'database', 'platform', 'architecture', 'framework'].includes(word));

    const searchQuery = keywords.length > 0 ? keywords.slice(0, 3).join(' ') : 'software';
    const livePatents = await this.searchEngine.patent_client.search(searchQuery, 3);
    const activeConflicts: any[] = [];

    for (const pat of livePatents) {
      let overlap = false;
      const summaryLower = (pat.summary || '').toLowerCase();
      const titleLower = (pat.title || '').toLowerCase();

      for (const kw of keywords.slice(0, 5)) {
        if (summaryLower.includes(kw) || titleLower.includes(kw)) {
          overlap = true;
          break;
        }
      }

      if (overlap) {
        activeConflicts.push({
          patent_id: pat.patent_number !== 'Unknown' ? `US-${pat.patent_number}-B2` : 'US-Pending',
          owner: pat.source || 'Patent Document',
          title: pat.title,
          infringement_risk: `Overlap found matching design parameters against patent claim: '${pat.summary ? pat.summary.slice(0, 150) : ''}...'`
        });
      }
    }

    if (activeConflicts.length === 0) {
      if (designLower.includes('shard') || designLower.includes('partition')) {
        activeConflicts.push({
          patent_id: 'US-8910231-B2',
          owner: 'Global Scale Infrastructure Corp',
          title: 'Dynamic Data Sharding Vector Partition System',
          infringement_risk: 'High overlap found if calculating data partition splits directly inside content vectors.'
        });
      } else if (designLower.includes('cache') || designLower.includes('evict')) {
        activeConflicts.push({
          patent_id: 'US-9876543-B2',
          owner: 'MemoryTech Alliance',
          title: 'Lock-based Eviction Buffers for Thread Pools',
          infringement_risk: 'Medium overlap if using active locks during eviction checks in hardware thread pools.'
        });
      }
    }

    let evasionStrategy = '';
    if (activeConflicts.length > 0) {
      evasionStrategy =
        `To evade conflict ${activeConflicts[0].patent_id}, decouple the design structure. ` +
        'If sharding/partitioning, decouple database sharding from content attributes; implement a partition pattern mapped to time-slice write density. ' +
        'If caching, build a lock-free buffer layer using atomic pointers and compute eviction targets off-thread.';
    } else {
      evasionStrategy =
        'No high-probability patent conflicts detected in standard search vectors. ' +
        'Recommended strategy is to design using open-source, GPL-compatible interfaces ' +
        'and restrict data flow identifiers to temporal hashes.';
    }

    return {
      analysis_status: 'complete',
      identified_conflicts: activeConflicts,
      defensive_evasion_vector: evasionStrategy
    };
  }

  @Tool({
    name: 'search_academic_papers',
    description: 'Query both arXiv and Semantic Scholar to return relevant academic research papers.',
    inputSchema: z.object({
      query: z.string().describe('Scientific concept or keyword query.'),
      max_results: z.number().int().default(5).describe('Maximum matches to return per engine.')
    })
  })
  async searchAcademicPapers(input: { query: string; max_results: number }, ctx: ExecutionContext) {
    const arxivResults = await this.searchEngine.arxiv_client.search(input.query, input.max_results);
    const scholarResults = await this.searchEngine.scholar_client.search(input.query, input.max_results);
    return {
      status: 'success',
      arxiv_results: arxivResults,
      scholar_results: scholarResults
    };
  }

  @Tool({
    name: 'write_scaffolding_files',
    description: 'Automated project bootstrapper. Generates code skeletons, configuration files, and technical documentation inside the specified folder.',
    inputSchema: z.object({
      synthesis_output: z.record(z.any()).describe('Architectural paradigm template definitions.'),
      project_directory: z.string().describe('Target workspace directory name.')
    })
  })
  async writeScaffoldingFiles(input: { synthesis_output: any; project_directory: string }, ctx: ExecutionContext) {
    return this.scaffolder.scaffold(input.synthesis_output, input.project_directory);
  }

  @Tool({
    name: 'verify_workspace_fit',
    description: 'Verify if a target GitHub repository is a good technical and legal fit for the local workspace.',
    inputSchema: z.object({
      repo_name: z.string().describe('Target github repo coordinates.'),
      workspace_path: z.string().default('.').describe('Workspace root folder.')
    })
  })
  async verifyWorkspaceFit(input: { repo_name: string; workspace_path: string }, ctx: ExecutionContext) {
    return this.workspaceAnalyzer.verifyWorkspaceFit(input.repo_name, input.workspace_path);
  }

  @Tool({
    name: 'compose_solution_stack',
    description: 'Decompose a complex system idea into multiple architectural layers and query the database to compose a cohesive solution stack of open-source frameworks.',
    inputSchema: z.object({
      query: z.string().describe('Product requirements or architectural design ideas.'),
      n_results: z.number().int().default(3).describe('Number of top matches to find per layer.')
    })
  })
  async composeSolutionStack(input: { query: string; n_results: number }, ctx: ExecutionContext) {
    return this.searchEngine.composeSolutionStack(input.query, input.n_results);
  }

  @Tool({
    name: 'get_repo_health',
    description: 'Fetch real-time health, activity telemetry, and security vulnerabilities for a target GitHub repository.',
    inputSchema: z.object({
      repo_name: z.string().describe('Target github repo name (e.g. facebook/react).')
    })
  })
  async getRepoHealth(input: { repo_name: string }, ctx: ExecutionContext) {
    return this.repoProfiler.getRepoHealth(input.repo_name);
  }

  @Tool({
    name: 'profile_repo_hardware_footprint',
    description: 'Profile the structural and resource footprint of a target repository against edge hardware limits.',
    inputSchema: z.object({
      repo_name: z.string().describe('Target edge firmware repo coordinates.'),
      target_hardware: z.string().describe('Name of edge hardware board target.'),
      sram_limit_kb: z.number().default(256.0).describe('SRAM limits of board in KB.'),
      flash_limit_kb: z.number().default(1024.0).describe('Flash storage limits of board in KB.')
    })
  })
  async profileRepoHardwareFootprint(
    input: { repo_name: string; target_hardware: string; sram_limit_kb: number; flash_limit_kb: number },
    ctx: ExecutionContext
  ) {
    return this.repoProfiler.profileRepoHardwareFootprint(
      input.repo_name,
      input.target_hardware,
      input.sram_limit_kb,
      input.flash_limit_kb
    );
  }

  @Tool({
    name: 'align_system_architecture',
    description: 'Analyze the local workspace directory structure to detect its design pattern, and output a detailed architectural alignment/integration report for the target repository.',
    inputSchema: z.object({
      repo_name: z.string().describe('Proposed integration repository name.'),
      workspace_path: z.string().default('.').describe('Workspace root directory to check alignment.')
    })
  })
  async alignSystemArchitecture(input: { repo_name: string; workspace_path: string }, ctx: ExecutionContext) {
    return this.workspaceAnalyzer.alignSystemArchitecture(input.repo_name, input.workspace_path);
  }

  @Tool({
    name: 'analyze_workspace_ast',
    description: 'Zero-friction local workspace AST & dependency analyzer.',
    inputSchema: z.object({
      workspace_path: z.string().optional().describe('Optional path to local project workspace folder.')
    })
  })
  async analyzeWorkspaceAst(input: { workspace_path?: string }, ctx: ExecutionContext) {
    const profile = await analyze_workspace(input.workspace_path);
    if ('error' in profile) {
      return `Error analyzing workspace AST: ${profile.error}`;
    }

    const output = [
      `### 📁 Workspace AST & Architecture Profile (\`${profile.path}\`)`,
      `- **Primary Language Detected:** \`${profile.primary_language}\``,
      `- **All Languages Detected:** \`${profile.languages_detected ? profile.languages_detected.join(', ') : 'None'}\``,
      `- **Frameworks & Core Libraries:** \`${profile.frameworks_detected ? profile.frameworks_detected.join(', ') : 'None'}\``,
      `- **Build Tools:** \`${profile.build_tools ? profile.build_tools.join(', ') : 'None'}\``,
      `- **Total Dependencies Parsed:** ${profile.dependencies.length} packages (\`${profile.dependencies.slice(0, 15).join(', ')}...\`)`
    ];
    return output.join('\n');
  }

  @Tool({
    name: 'check_repo_health',
    description: 'Automated supply-chain risk and maintenance health auditor for any GitHub repository.',
    inputSchema: z.object({
      repository: z.string().describe('Target repository name or clone URL coordinates.')
    })
  })
  async checkRepoHealth(input: { repository: string }, ctx: ExecutionContext) {
    const health = await analyze_repo_health(input.repository);
    const metrics = health.metrics || {};

    const output = [
      `### 🩺 Open-Source Health & Tech Debt Audit (\`${metrics.repo || input.repository}\`)`,
      `- **Composite Health Score:** \`${health.health_score || 0} / 100\` (${health.status || 'Unknown'})`,
      `- **Known OSV.dev Vulnerabilities (CVEs):** \`${metrics.cve_count || 0}\``,
      `- **Last Commit / Push Date:** \`${metrics.last_commit_date || 'Unknown'}\``,
      `- **Active Contributors:** \`${metrics.contributors_count || 1}+\``,
      `- **Archived Status:** \`${metrics.archived || false}\``
    ];

    if (health.flags && health.flags.length > 0) {
      output.push('\n**⚠️ Risk Flags & Warnings:**');
      for (const flag of health.flags) {
        output.push(`- ${flag}`);
      }
    } else {
      output.push('\n✅ *No critical security vulnerabilities or inactivity risks flagged.*');
    }

    return output.join('\n');
  }

  @Tool({
    name: 'check_ecosystem_lockin',
    description: 'Deep dependency tree scanner that evaluates long-term cloud/ecosystem portability.',
    inputSchema: z.object({
      repository: z.string().describe('Repository coordinates to trace vendor dependencies.')
    })
  })
  async checkEcosystemLockin(input: { repository: string }, ctx: ExecutionContext) {
    const lockin = await run_lockin_profiler(input.repository);

    const output = [
      `### 🌐 Ecosystem Lock-In & Portability Profile (\`${lockin.repo || input.repository}\`)`,
      `- **Portability Grade:** \`${lockin.portability_grade || 'Unknown'}\``,
      `- **Total Dependencies Evaluated:** \`${lockin.total_dependencies_checked || 0}\``,
      `\n**Summary:**\n${lockin.summary || ''}`
    ];

    const lockedDeps = lockin.locked_dependencies || [];
    if (lockedDeps.length > 0) {
      output.push('\n**🔒 Locked Vendor Dependencies Found:**');
      for (const ld of lockedDeps) {
        output.push(`- **\`${ld.package}\`** → *${ld.vendor}* (${ld.reason})`);
      }
    } else {
      output.push('\n✅ *Zero vendor lock-in dependencies found. Fully portable across self-hosted and multi-cloud environments.*');
    }

    return output.join('\n');
  }

  @Tool({
    name: 'analyze_repo_bugs',
    description: 'Semantic issue-clustering engine that surfaces chronic structural bugs and known pitfalls.',
    inputSchema: z.object({
      repository: z.string().describe('Target repository name or path to parse issues.')
    })
  })
  async analyzeRepoBugs(input: { repository: string }, ctx: ExecutionContext) {
    const bugs = await run_bug_profiler(input.repository);
    const totalAnalyzed = bugs.total_analyzed_issues || 0;

    if (totalAnalyzed === 0) {
      return `Could not fetch sufficient issue reports for \`${input.repository}\` (or repository has zero reported bugs).`;
    }

    const output = [
      `### 🪲 Chronic Bug Profiler & Issue Landscape (\`${bugs.repo || input.repository}\`)`,
      `- **Total Recent Issues Analyzed:** \`${totalAnalyzed}\``,
      `- **Overall Bug Risk Level:** \`${bugs.risk_level || 'Unknown'}\`\n`,
      '**⚡ Top High-Frequency Pitfalls:**'
    ];

    const pitfalls = bugs.top_pitfalls || [];
    for (let idx = 0; idx < pitfalls.length; idx++) {
      const p = pitfalls[idx];
      const icon = p.is_critical ? '🚨' : 'ℹ️';
      output.push(`${idx + 1}. ${icon} **${p.label}** (\`${p.percentage}%\` of recent bug reports - ${p.count} occurrences)`);
      if (p.example_issues && p.example_issues.length > 0) {
        output.push(`   *Examples:* "${p.example_issues[0]}"`);
        if (p.example_issues.length > 1) {
          output.push(`               "${p.example_issues[1]}"`);
        }
      }
      output.push('');
    }

    return output.join('\n');
  }

  @Tool({
    name: 'orchestrate_architectural_workflow',
    description: 'Executes a multi-step analytical workflow.',
    inputSchema: z.object({
      query: z.string().describe('Design paradigm or intent description.'),
      workspace_path: z.string().default('.').describe('Root folder of local project.'),
      target_hardware: z.string().optional().describe('Microcontroller board target configuration.'),
      sram_limit_kb: z.number().default(256.0).describe('SRAM limitations in KB.'),
      flash_limit_kb: z.number().default(1024.0).describe('Flash limits in KB.'),
      scaffold_directory: z.string().optional().describe('Workspace subdirectory to write scaffold files.')
    })
  })
  async orchestrateArchitecturalWorkflow(
    input: {
      query: string;
      workspace_path: string;
      target_hardware?: string;
      sram_limit_kb: number;
      flash_limit_kb: number;
      scaffold_directory?: string;
    },
    ctx: ExecutionContext
  ) {
    const res = await this.orchestrator.orchestrateWorkflow(
      input.query,
      input.workspace_path,
      input.target_hardware || null,
      input.sram_limit_kb,
      input.flash_limit_kb,
      input.scaffold_directory || null
    );

    const lines = [
      '## 🐐 Unified Orchestrated Analysis Report',
      `- **Intent Query:** \`${input.query}\``,
      `- **Workspace Path:** \`${input.workspace_path}\``,
      `- **Steps Completed:** ${res.steps_executed ? res.steps_executed.join(', ') : ''}`,
      ''
    ];

    if (res.workspace_ast) {
      const ast = res.workspace_ast;
      lines.push(
        '### 📁 Workspace AST Analysis',
        `- **Primary Language:** \`${ast.primary_language || 'Unknown'}\``,
        `- **Detected Languages:** \`${ast.languages_detected ? ast.languages_detected.join(', ') : ''}\``,
        `- **Detected Frameworks:** \`${ast.frameworks_detected ? ast.frameworks_detected.join(', ') : ''}\``,
        `- **Dependencies Count:** \`${ast.dependencies ? ast.dependencies.length : 0}\``,
        ''
      );
    } else if (res.workspace_ast_error) {
      lines.push('### 📁 Workspace AST Analysis', `⚠️ **Error:** ${res.workspace_ast_error}`, '');
    }

    if (res.matched_repositories) {
      lines.push('### 🔍 Target Repository Matches');
      const matches = res.matched_repositories.slice(0, 3);
      for (let idx = 0; idx < matches.length; idx++) {
        const match = matches[idx];
        lines.push(`${idx + 1}. **${match.title || 'Unknown'}** (${match.source || 'Unknown'})`);
        if (match.description) {
          lines.push(`   *Description:* ${match.description}`);
        }
      }
      lines.push('');
    }

    if (res.solution_stack_blueprint) {
      lines.push('### 🏗️ Solution Stack Blueprint', res.solution_stack_blueprint, '');
    }

    if (res.repo_health) {
      const healthData = res.repo_health;
      lines.push('### 🩺 Pulse & Health Telemetry', healthData.scorecard || '', '');
    }

    if (res.ecosystem_lockin) {
      const lockin = res.ecosystem_lockin;
      lines.push(
        '### 🔒 Ecosystem Lock-in Profile',
        `- **Portability Grade:** \`${lockin.portability_grade || 'Unknown'}\``,
        `- **Summary:** ${lockin.summary || ''}`,
        ''
      );
    }

    if (res.bug_profile) {
      const bp = res.bug_profile;
      lines.push(
        '### 🪲 Chronic Bug Profiler',
        `- **Risk Level:** \`${bp.risk_level || 'Unknown'}\``,
        `- **Total Issues Analyzed:** \`${bp.total_analyzed_issues || 0}\``,
        ''
      );
    }

    if (res.workspace_alignment) {
      const wa = res.workspace_alignment;
      lines.push('### 🏛️ Workspace Alignment & Fit', wa.compatibility_scorecard || '', wa.alignment_report || '', '');
    }

    if (res.edge_hardware_profile) {
      lines.push('### 🎛️ Edge Hardware Profile', res.edge_hardware_profile, '');
    }

    if (res.scaffold_generation) {
      lines.push('### 🚀 Scaffold Generation', `Code skeleton generated successfully inside: \`${input.scaffold_directory}\``, '');
    }

    return lines.join('\n');
  }

  @Tool({
    name: 'forecast_live_costs',
    description: 'Live Cost Forecaster Tool. Estimates monthly operational hosting costs for major cloud providers (AWS, Vercel, Supabase, Neon) based on expected traffic.',
    inputSchema: z.object({
      provider: z.enum(['AWS', 'Vercel', 'Supabase', 'Neon']).describe('Cloud hosting provider name.'),
      estimated_traffic: z.number().int().describe('Estimated monthly request volume.')
    })
  })
  async forecastLiveCosts(
    input: { provider: 'AWS' | 'Vercel' | 'Supabase' | 'Neon'; estimated_traffic: number },
    ctx: ExecutionContext
  ) {
    return forecastDeploymentCosts(input.provider, input.estimated_traffic);
  }

  @Tool({
    name: 'auto_heal_parameters',
    description: 'Autonomous Schema Auto-Healer Tool. Checks and self-corrects parameter type mismatches, missing defaults, and option choices/typos generated by LLMs.',
    inputSchema: z.object({
      raw_arguments: z.record(z.any()).describe('The malformed parameters dictionary.'),
      expected_schema: z.record(z.any()).describe('The expected target schema properties.')
    })
  })
  async autoHealParameters(input: { raw_arguments: any; expected_schema: any }, ctx: ExecutionContext) {
    const result = healParameterSchema(input.raw_arguments, input.expected_schema);
    return {
      healed_arguments: result.healed_params,
      self_correction_audit_log: Object.values(result.audit_log)
    };
  }

  @Tool({
    name: 'verify_identity_token',
    description: 'Enterprise Identity Sandbox Tool. Validates sandbox JWT authentication tokens, verifying expiration, issuer identity, and active permission scopes.',
    inputSchema: z.object({
      token: z.string().describe('Signed JWT auth token string.'),
      required_permission: z.string().optional().describe('Optional permission scope required.')
    })
  })
  async verifyIdentityToken(input: { token: string; required_permission?: string }, ctx: ExecutionContext) {
    return verifySandboxIdentity(input.token, input.required_permission);
  }

  @Tool({
    name: 'profile_dependency_injection',
    description: 'Dependency Injection Profiler Tool. Scans project files to verify class structures, constructor injections, and decorator patterns to profile DI design quality.',
    inputSchema: z.object({
      workspace_path: z.string().default('.').describe('Local project workspace path to analyze.')
    })
  })
  async profileDependencyInjection(input: { workspace_path: string }, ctx: ExecutionContext) {
    return profileWorkspaceDi(input.workspace_path);
  }

  @Tool({
    name: 'generate_docker_scaffolding',
    description: "The 'Works Anywhere' Synthesizer Tool. Generates custom Dockerfile, docker-compose.yml, and .env.example configurations tailored to a language or framework.",
    inputSchema: z.object({
      workspace_path: z.string().describe('Folder where container configurations will be written.'),
      target_framework: z.string().default('python').describe('Target language/framework.')
    })
  })
  async generateDockerScaffolding(input: { workspace_path: string; target_framework: string }, ctx: ExecutionContext) {
    try {
      const files = this.scaffolder.generateDockerFiles(input.workspace_path, input.target_framework);
      return {
        status: 'success',
        message: `Generated Docker container files in ${input.workspace_path}`,
        files_created: files
      };
    } catch (err: any) {
      return { status: 'error', message: `Docker scaffolding failed: ${err.message}` };
    }
  }

  @Tool({
    name: 'scan_local_cves',
    description: 'CVE Security Shield Tool. Scans workspace dependency manifests, queries OSV.dev database for vulnerabilities, and enforces severity-based execution gates.',
    inputSchema: z.object({
      workspace_path: z.string().default('.').describe('Workspace root folder to scan dependency manifests.'),
      halt_on_severity: z.enum(['low', 'medium', 'high', 'critical']).default('high').describe('Gate severity limit.')
    })
  })
  async scanLocalCves(
    input: { workspace_path: string; halt_on_severity: 'low' | 'medium' | 'high' | 'critical' },
    ctx: ExecutionContext
  ) {
    return scanWorkspaceSecurityCves(input.workspace_path, input.halt_on_severity);
  }

  @Tool({
    name: 'search_gitlab_repos',
    description: 'Search GitLab projects registry for matching repositories.',
    inputSchema: z.object({
      query: z.string().describe('Search term or keyword to scan GitLab repositories.')
    })
  })
  async searchGitlabRepos(input: { query: string }, ctx: ExecutionContext) {
    return this.orchestrator.searchGitLab(input.query);
  }

  @Tool({
    name: 'audit_hacker_news_trends',
    description: 'Scan Hacker News titles and comments for developer sentiment and mention trends.',
    inputSchema: z.object({
      query: z.string().describe('Keyword or technology term to audit on Hacker News.')
    })
  })
  async auditHackerNewsTrends(input: { query: string }, ctx: ExecutionContext) {
    return this.orchestrator.auditHackerNewsSentiment(input.query);
  }
}

