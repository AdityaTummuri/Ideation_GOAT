import { settings } from './config.js';
import { ArXivClient, ArXivPaper } from './arxiv_client.js';
import { ScholarClient, ScholarPaper } from './scholar_client.js';
import { PatentClient, PatentResult } from './patent_client.js';

export interface RepositoryMatch {
  source: string;
  title: string;
  url?: string;
  summary: string;
  language?: string;
  stars?: number;
  category?: string;
  type?: string;
  abstract?: string;
  domain?: string;
  latent_mechanism?: string;
  fit_analogy?: string;
  bridge_catalyst_prompt?: string;
}

export class CrossDomainSearchEngine {
  public readonly arxiv_client: ArXivClient;
  public readonly scholar_client: ScholarClient;
  public readonly patent_client: PatentClient;

  public readonly mock_repos = [
    { source: 'GitHub', title: 'CacheGraphene', url: 'https://github.com/example/CacheGraphene', summary: 'Lock-free persistent LRU caching layer utilizing transactional memory primitives.', category: 'cs.SE' },
    { source: 'GitHub', title: 'MeshFlow', url: 'https://github.com/example/MeshFlow', summary: 'High-performance service mesh router optimizing network package distribution using adaptive load balancing.', category: 'cs.NI' },
    { source: 'GitHub', title: 'RaftGuardian', url: 'https://github.com/example/RaftGuardian', summary: 'Distributed consensus framework with automated partition recovery and split-brain resolution loops.', category: 'cs.DC' },
    { source: 'GitHub', title: 'ShedValve', url: 'https://github.com/example/ShedValve', summary: 'Concurrent queue with automatic load-shedding and flow-throttling under heavy CPU write spikes.', category: 'cs.DS' },
    { source: 'GitHub', title: 'SecurInvert', url: 'https://github.com/example/SecurInvert', summary: 'Privacy-preserving database perturbation engine generating noise vectors to shield analytical queries.', category: 'cs.CR' }
  ];

  public readonly cross_domain_analogs = [
    {
      id: 'bio-01',
      source: 'Semantic Scholar (Neurobiology)',
      domain: 'Biology / Neurobiology',
      title: 'Cephalopod Synaptic Decay & Eviction Dynamics',
      summary: 'Mathematical modeling of non-linear neurotransmitter decay pathways that optimize neural energy distribution by evicting low-frequency signals.',
      latent_mechanism: 'Dynamic, non-linear energy-consumption-aware signal decay.',
      fit_analogy: 'Instead of static TTL (Time-To-Live) or traditional LRU (Least Recently Used) caching, evict cache keys dynamically based on a state decay curve matching compute/memory overhead constraints.',
      keywords: ['cache', 'evict', 'memory', 'lru', 'ttl', 'storage', 'database', 'expire']
    },
    {
      id: 'botany-01',
      source: 'arXiv (Plant Biology)',
      domain: 'Biology / Botany',
      title: 'Leaf Vein Network Optimization under Variable Transpiration',
      summary: 'How angiosperm venation patterns dynamically reroute water flow around localized damage or high evaporation zones using hierarchical loop redundancy.',
      latent_mechanism: 'Hierarchical redundant loop rerouting.',
      fit_analogy: 'Applies to CDN routing or service mesh traffic balancing by creating self-healing, mesh-loop pathways that route around failed nodes without global routing table updates.',
      keywords: ['route', 'load', 'network', 'mesh', 'traffic', 'cdn', 'distribute', 'balancer']
    },
    {
      id: 'patent-01',
      source: 'Google Patents (Materials Science)',
      domain: 'Mechanical Engineering / Materials Science',
      title: 'Self-Healing Structural Composites (US-9876543-B2)',
      summary: 'A composite material embedded with micro-capsules of healing agents that rupture under stress or cracks, autonomously sealing the structural integrity of the wing.',
      latent_mechanism: 'Localized micro-capsule stress-induced autonomous healing.',
      fit_analogy: 'In a distributed database cluster, encapsulate state partitions in localized monitoring envelopes (\'micro-capsules\') that automatically instantiate isolated repair actions (like re-replication or log rebuilding) when load/error thresholds cross a critical rupture point.',
      keywords: ['heal', 'failover', 'cluster', 'recovery', 'database', 'fault', 'elastic', 'replicate']
    },
    {
      id: 'hydraulics-01',
      source: 'Google Patents (Hydraulic Systems)',
      domain: 'Fluid Dynamics / Hydraulics',
      title: 'Self-Cleaning Pressure-Drop Manifold (US-5412901-A)',
      summary: 'A hydraulic manifold that uses passive pressure-differential valves to automatically flush debris and shed high-pressure surges without stopping downstream flow.',
      latent_mechanism: 'Passive pressure-differential feedback loop shedding.',
      fit_analogy: 'Applies to queue load-shedding and rate-limiting. Instead of active CPU-intensive inspection of incoming queues, use a passive rate-differential filter that dumps overflow traffic directly to cold logging tables when queue pressure spikes.',
      keywords: ['queue', 'overflow', 'pressure', 'rate', 'limit', 'shed', 'concurrency', 'buffer']
    },
    {
      id: 'acoustics-01',
      source: 'Semantic Scholar (Acoustic Engineering)',
      domain: 'Physics / Acoustics',
      title: 'Adaptive Noise Cancellation Waveform Inversion',
      summary: 'Real-time academic wave phase inversion algorithms that dynamically cancel ambient background noise by generating destructive interference fields.',
      latent_mechanism: 'Destructive interference phase inversion.',
      fit_analogy: 'Applies to database privacy protection or adversarial defense. Generate \'destructive interference\' fake data records in real-time that cancel out the signature of user search trends, protecting database queries against side-channel analysis.',
      keywords: ['noise', 'cancel', 'filter', 'privacy', 'secure', 'perturb', 'defense', 'obfuscate']
    }
  ];

  constructor() {
    this.arxiv_client = new ArXivClient();
    this.scholar_client = new ScholarClient();
    this.patent_client = new PatentClient();
  }

  /**
   * Queries the vector database:
   * 1. Supabase (pgvector RPC) if SUPABASE_URL and SUPABASE_KEY are set.
   * 2. Pinecone if PINECONE_API_KEY and PINECONE_INDEX_URL are set.
   * 3. Local ChromaDB over HTTP if active.
   * 4. Local mock repository keyword lookup fallback.
   */
  public async queryVectorDb(queryTerm: string, nResults: number = 5): Promise<RepositoryMatch[]> {
    let embedding: number[] | null = null;
    
    // Compute embedding using OpenAI if configured
    if (settings.OPENAI_API_KEY) {
      try {
        const res = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: queryTerm
          })
        });
        if (res.ok) {
          const resData = (await res.json()) as any;
          embedding = resData.data?.[0]?.embedding || null;
        }
      } catch (err: any) {
        console.warn(`Could not compute OpenAI embedding: ${err.message}`);
      }
    }

    // 1. Supabase (pgvector RPC)
    if (settings.SUPABASE_URL && settings.SUPABASE_KEY && embedding) {
      try {
        const url = `${settings.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/match_repositories`;
        const headers = {
          'Content-Type': 'application/json',
          'apikey': settings.SUPABASE_KEY,
          'Authorization': `Bearer ${settings.SUPABASE_KEY}`
        };
        const body = {
          query_embedding: embedding,
          match_threshold: 0.2,
          match_count: nResults
        };
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        if (response.ok) {
          const resData = (await response.json()) as any[];
          const matches: RepositoryMatch[] = resData.map((item) => ({
            source: 'GitHub (Supabase)',
            title: item.name || 'Unknown',
            url: item.url || '#',
            summary: item.summary || item.description || '',
            language: item.language || 'Unknown',
            stars: parseInt(item.stars || '0', 10),
            category: item.category || 'cs.SE'
          }));
          if (matches.length > 0) {
            console.warn(`Retrieved ${matches.length} matches from Supabase pgvector.`);
            return matches;
          }
        }
      } catch (err: any) {
        console.error(`Supabase pgvector query failed: ${err.message}. Falling back.`);
      }
    }

    // 2. Pinecone
    if (settings.PINECONE_API_KEY && settings.PINECONE_INDEX_URL && embedding) {
      try {
        const url = `${settings.PINECONE_INDEX_URL.replace(/\/$/, '')}/query`;
        const headers = {
          'Content-Type': 'application/json',
          'Api-Key': settings.PINECONE_API_KEY
        };
        const body = {
          vector: embedding,
          topK: nResults,
          includeMetadata: true
        };
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        if (response.ok) {
          const resData = (await response.json()) as any;
          const matches: RepositoryMatch[] = (resData.matches || []).map((item: any) => {
            const metadata = item.metadata || {};
            return {
              source: 'GitHub (Pinecone)',
              title: metadata.name || 'Unknown',
              url: metadata.url || '#',
              summary: metadata.summary || metadata.description || '',
              language: metadata.language || 'Unknown',
              stars: parseInt(metadata.stars || '0', 10),
              category: metadata.category || 'cs.SE'
            };
          });
          if (matches.length > 0) {
            console.warn(`Retrieved ${matches.length} matches from Pinecone index.`);
            return matches;
          }
        }
      } catch (err: any) {
        console.error(`Pinecone query failed: ${err.message}. Falling back.`);
      }
    }

    // 3. Fallback to local ChromaDB over HTTP if active
    try {
      // Check ChromaDB HTTP server
      const chromaUrl = 'http://localhost:8000/api/v1';
      const collectionsRes = await fetch(`${chromaUrl}/collections`);
      if (collectionsRes.ok) {
        const collections = (await collectionsRes.json()) as any[];
        const targetColl = collections.find((c) => c.name === settings.CHROMADB_COLLECTION);
        if (targetColl) {
          const queryRes = await fetch(`${chromaUrl}/collections/${targetColl.id}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query_texts: [queryTerm],
              n_results: nResults
            })
          });
          if (queryRes.ok) {
            const results = (await queryRes.json()) as any;
            const matches: RepositoryMatch[] = [];
            if (results && results.ids && results.ids[0] && results.ids[0].length > 0) {
              for (let i = 0; i < results.ids[0].length; i++) {
                const metadata = results.metadatas[0][i] || {};
                matches.push({
                  source: 'GitHub',
                  title: metadata.name || 'Unknown',
                  url: metadata.url || '#',
                  summary: results.documents[0][i] || '',
                  language: metadata.language || 'Unknown',
                  stars: parseInt(metadata.stars || '0', 10),
                  category: 'cs.SE'
                });
              }
            }
            if (matches.length > 0) {
              return matches;
            }
          }
        }
      }
    } catch (err: any) {
      // Quietly ignore ChromaDB HTTP error and fall back to keyword search
    }

    return this.queryMockRepos(queryTerm, nResults);
  }

  private queryMockRepos(queryTerm: string, nResults: number): RepositoryMatch[] {
    const matches: RepositoryMatch[] = [];
    const queryWords = queryTerm.toLowerCase().split(/\s+/);
    for (const repo of this.mock_repos) {
      const repoText = `${repo.title} ${repo.summary}`.toLowerCase();
      if (queryWords.some((word) => repoText.includes(word))) {
        matches.push(repo);
      }
    }
    return matches.slice(0, nResults);
  }

  /**
   * Target Mode: Gathers direct implementation code from GitHub and papers from arXiv.
   */
  public async searchTarget(query: string): Promise<RepositoryMatch[]> {
    const localMatches = await this.queryVectorDb(query, 3);
    const arxivMatches = await this.arxiv_client.search(query, settings.ARXIV_MAX_RESULTS);
    
    // Map ArXivPaper to RepositoryMatch
    const mappedArxiv: RepositoryMatch[] = arxivMatches.map((p) => ({
      source: `arXiv (${p.category})`,
      title: p.title,
      url: p.url,
      summary: p.summary,
      category: p.category
    }));

    return [...localMatches, ...mappedArxiv];
  }

  /**
   * Discovery Mode: Inverse-Similarity Serendipity Search.
   * Skips exact CS domain matches, forcing search into biology, mechanics, physics.
   */
  public async searchDiscovery(query: string, cognitiveDistance: number): Promise<RepositoryMatch[]> {
    const rawPapers = await this.arxiv_client.search(query, 4);
    const scholarPapers = await this.scholar_client.search(query, 3);

    // Combine academic papers
    const allAcademic: any[] = [];
    for (const paper of rawPapers) {
      allAcademic.push(paper);
    }
    for (const paper of scholarPapers) {
      allAcademic.push({
        source: paper.source,
        title: paper.title,
        url: paper.url,
        summary: paper.summary,
        category: 'non-cs',
        citations: paper.citations,
        doi: paper.doi,
        is_open_access: paper.is_open_access,
        pdf_url: paper.pdf_url
      });
    }

    // Apply Inverse-Similarity Filter: Ignore CS clusters to escape domain bubbles
    const filteredPapers = allAcademic.filter((paper) => {
      const category = paper.category || '';
      if (category.startsWith('cs.')) {
        console.warn(`Filtering out CS paper '${paper.title}' (Category: ${category}) in Discovery Mode.`);
        return false;
      }
      return true;
    });

    // Match query keywords to cross-domain analogy catalog
    const queryLower = query.toLowerCase();
    let analogMatches = this.cross_domain_analogs.filter((analog) =>
      analog.keywords.some((kw) => queryLower.includes(kw))
    );

    if (analogMatches.length === 0) {
      analogMatches = this.cross_domain_analogs.slice(0, 2);
    }

    const matches: RepositoryMatch[] = [];
    for (const paper of filteredPapers.slice(0, 3)) {
      const categorySuffix = paper.category ? ` - ${paper.category}` : '';
      matches.push({
        source: `Academic Research (${paper.source}${categorySuffix})`,
        title: paper.title,
        url: paper.url,
        summary: paper.summary,
        type: 'Cross-Domain Research Paper'
      });
    }

    for (const analog of analogMatches) {
      const catalystPrompt = 
        `ACT AS A CONCEPTUAL TRANSLATOR & CROSS-DOMAIN CONSULTANT.\n` +
        `The user wanted to build: '${query}'.\n` +
        `We discovered a structurally parallel system in Y (${analog.domain}): '${analog.title}'.\n` +
        `Explain the hidden bridge: how applying the mechanism of '${analog.latent_mechanism}' ` +
        `to '${query}' unlocks a novel architectural paradigm. Output your analysis using the format:\n` +
        `1. **The Hidden Bridge**: Map Y's physical/biological dynamics directly to X.\n` +
        `2. **Architectural Grafting**: Concrete steps to implement Y's rules in X's database/software context.\n` +
        `3. **Unlocked Potential**: What performance or design limits this improves (e.g. 10x throughput, lock evasion).`;

      matches.push({
        source: analog.source,
        domain: analog.domain,
        title: analog.title,
        latent_mechanism: analog.latent_mechanism,
        fit_analogy: analog.fit_analogy,
        summary: analog.summary,
        type: 'Cross-Domain Analogy',
        bridge_catalyst_prompt: catalystPrompt
      });
    }

    return matches;
  }

  /**
   * Decompose a complex system idea into multiple architectural layers and query the database
   * to compose a cohesive solution stack of open-source frameworks.
   */
  public async composeSolutionStack(query: string, nResults: number = 3): Promise<string> {
    const layers = {
      'Frontend / Client': {
        keywords: ['ui', 'frontend', 'mobile', 'web', 'app', 'react', 'vue', 'flutter', 'ios', 'android', 'client'],
        subquery: 'frontend UI client app mobile web framework user interface'
      },
      'Backend / API': {
        keywords: ['backend', 'server', 'api', 'routing', 'microservice', 'http', 'grpc', 'framework'],
        subquery: 'backend API server web framework routing controller microservice'
      },
      'Database / Storage': {
        keywords: ['database', 'storage', 'sql', 'nosql', 'orm', 'caching', 'cache', 'sqlite', 'postgres', 'redis', 'offline'],
        subquery: 'database storage SQL NoSQL ORM caching persistence offline'
      },
      'Security / Auth': {
        keywords: ['security', 'auth', 'authentication', 'encryption', 'cryptography', 'jwt', 'cipher', 'secure'],
        subquery: 'security authentication authorization cryptography encryption token JWT cipher'
      },
      'Transport / Sync': {
        keywords: ['sync', 'syncing', 'transport', 'websocket', 'network', 'communication', 'pubsub', 'real-time'],
        subquery: 'real-time syncing network transport communication websocket pubsub socket'
      }
    };

    const queryLower = query.toLowerCase();
    const activeLayers: Record<string, { keywords: string[]; subquery: string }> = {};

    for (const [layerName, config] of Object.entries(layers)) {
      if (config.keywords.some((kw) => queryLower.includes(kw)) || queryLower.split(/\s+/).length < 4) {
        activeLayers[layerName] = config;
      }
    }

    const finalLayers = Object.keys(activeLayers).length > 0 ? activeLayers : layers;
    const output: string[] = [];
    output.push(`# 🏗️ Architectural Solution Stack Blueprint for: '${query}'\n`);
    output.push('This blueprint was generated by analyzing the sub-components of your idea and matching them against indexed frameworks.\n');

    for (const [layerName, config] of Object.entries(finalLayers)) {
      const layerQuery = `${query} ${config.subquery}`;
      const results = await this.queryVectorDb(layerQuery, nResults);

      output.push(`### 📦 Layer: ${layerName}`);

      if (results.length === 0) {
        output.push('No matched components found in the local index for this layer.\n');
        continue;
      }

      for (let i = 0; i < results.length; i++) {
        const match = results[i];
        const title = match.title || 'Unknown';
        const url = match.url || '#';
        const summary = match.summary || 'No details available.';
        const stars = match.stars || 0;
        const starsStr = stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars.toString();
        const starsPart = stars ? ` | *Stars:* ⭐ ${starsStr}` : '';

        output.push(`${i + 1}. **[${title}](${url})**`);
        output.push(`   *Language:* \`${match.language || 'Unknown'}\`${starsPart}`);
        const snippet = summary.length > 200 ? `${summary.slice(0, 200)}...` : summary;
        output.push(`   *Role:* ${snippet}`);
      }
      output.push('');
    }

    output.push('---');
    output.push('### 🔗 Integration & Compatibility Guide');
    output.push('Ensure the components you select share a common language ecosystem or communicate via standardized network protocols (REST, WebSockets, or gRPC). For instance, a TypeScript-based offline storage engine pairs perfectly with a React Native or Node.js runtime.');

    return output.join('\n');
  }

  /**
   * Uses an LLM (Gemini or OpenAI) to generate a brief summary explaining
   * why the top matched frameworks fit the user's idea and how they solve it.
   */
  public async synthesizeWhyFits(query: string, matches: RepositoryMatch[]): Promise<string> {
    if (matches.length === 0) {
      return 'No matches found to synthesize.';
    }

    const summaryText = matches
      .slice(0, 3)
      .map((m) => `- ${m.title || 'Unknown'}: ${m.summary || m.abstract || ''}`)
      .join('\n');

    // 1. Try Gemini
    if (settings.GEMINI_API_KEY) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.GEMINI_API_KEY}`;
        const promptContent = 
          `The user wants to build: '${query}'.\n` +
          `Here are the top matched tools/frameworks:\n${summaryText}\n` +
          `Provide a concise, 2-3 sentence expert synthesis explaining why these options ` +
          `are a good fit and how the developer should combine or use them.`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptContent }] }]
          })
        });

        if (response.ok) {
          const resData = (await response.json()) as any;
          const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return text.trim();
          }
        }
      } catch (err: any) {
        console.warn(`Gemini synthesis failed: ${err.message}`);
      }
    }

    // 2. Try OpenAI
    if (settings.OPENAI_API_KEY) {
      try {
        const url = 'https://api.openai.com/v1/chat/completions';
        const promptContent = 
          `The user wants to build: '${query}'.\n` +
          `Here are the top matched tools/frameworks:\n${summaryText}\n` +
          `Provide a concise, 2-3 sentence expert synthesis explaining why these options ` +
          `are a good fit and how the developer should combine or use them.`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: promptContent }],
            max_tokens: 150
          })
        });

        if (response.ok) {
          const resData = (await response.json()) as any;
          const text = resData.choices?.[0]?.message?.content;
          if (text) {
            return text.trim();
          }
        }
      } catch (err: any) {
        console.warn(`OpenAI synthesis failed: ${err.message}`);
      }
    }

    // 3. Dynamic Rule-based Fallback
    const explanation: string[] = [];
    explanation.push('### 🧠 Architectural Synthesis (Rule-based Fallback)');
    explanation.push(`Based on your requirements to build **'${query}'**, we matched the following frameworks:`);
    for (const m of matches.slice(0, 3)) {
      explanation.push(`- **${m.title || 'Unknown'}** (${m.source || 'Index'}): Best suited to handle the core operational characteristics of your intent.`);
    }
    explanation.push('\n**Recommendation**: Integrate these components using clean interfaces. For example, wrap the storage engine within a repository adapter and access it from your business logic layer to prevent direct dependency coupling.');
    
    return explanation.join('\n');
  }
}
