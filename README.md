<div align="center">
  <h1>Ideation GOAT</h1>
  <p><strong>Cross-Domain Cross-Pollination & Ideation Engine for AI Agents</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/TypeScript-ESM-blue.svg" alt="TypeScript Version">
    <img src="https://img.shields.io/badge/MCP-NitroStack-purple.svg" alt="MCP">
    <img src="https://img.shields.io/badge/License-GPL--3.0-green.svg" alt="License">
  </p>
</div>

---

The Multi-Domain Semantic Architect Agent is an enterprise-grade Model Context Protocol server that operates as the analytical and creative subconscious of advanced AI coding agents. It exposes **24 autonomous diagnostic tools** spanning three distinct knowledge domains — codebases, academic research, and visual design — enabling AI agents to validate technical compatibility, audit supply-chain security, hybridize cross-domain concepts, and scaffold production-ready project architectures in a single unified pipeline.

Powered by **Gemini 3.1 Flash Lite** for high-speed structural reasoning, enforced by Zod-based schemas, and built natively with the **NitroStack** framework for serverless MCP hosting.

---

## 🏗️ System Architecture

```mermaid
graph TD
    %% ═══════════════════════════════════════════════════
    %% COLOUR CLASSES
    %% ═══════════════════════════════════════════════════
    classDef client   fill:#1e293b,stroke:#94a3b8,color:#f1f5f9,stroke-width:2px
    classDef gateway  fill:#312e81,stroke:#818cf8,color:#e0e7ff,stroke-width:2px
    classDef brain    fill:#7c3aed,stroke:#c4b5fd,color:#fff,stroke-width:3px
    classDef d1node   fill:#0c4a6e,stroke:#38bdf8,color:#e0f2fe,stroke-width:1.5px
    classDef d2node   fill:#064e3b,stroke:#34d399,color:#d1fae5,stroke-width:1.5px
    classDef d3node   fill:#431407,stroke:#fb923c,color:#ffedd5,stroke-width:1.5px
    classDef db       fill:#78350f,stroke:#fbbf24,color:#fef3c7,stroke-width:2px

    %% ═══════════════════════════════════════════════════
    %% TIER 1 — HOST INGESTION LAYER
    %% ═══════════════════════════════════════════════════
    Client["🖥️  IDE Host · Claude Desktop · Custom AI Swarm"]:::client
    Client -->|"stdio  ·  JSON-RPC 2.0"| Gateway["⚡ NitroStack Server  ·  JSON-RPC Gateway"]:::gateway
    Gateway --> Brain

    %% ═══════════════════════════════════════════════════
    %% TIER 3 — MASTER BRAIN
    %% ═══════════════════════════════════════════════════
    Brain(["🧠  Master Workflow Orchestrator\norchestrator.ts"]):::brain

    %% ═══════════════════════════════════════════════════
    %% TIER 4a — DOMAIN 1: CODEBASE & FRAMEWORKS
    %% ═══════════════════════════════════════════════════
    Brain -->|"Codebase & Infra query"| D1

    subgraph D1 ["📁  DOMAIN 1 — Codebase & Open Source Frameworks"]
        direction TB
        D1_AST["📂  Local AST Scanner\npackage.json · tsconfig.json"]:::d1node
        D1_GH["🐙  GitHub Registry Search\nRepo match · Star velocity · PR activity"]:::d1node
        D1_GL["🦊  GitLab Projects Integration\nGitLab API · cross-registry sourcing"]:::d1node
        D1_HN["📰  Hacker News Sentiment Auditor\nReal-time developer mention trends"]:::d1node
        D1_CVE["🛡️  OSV.dev CVE Security Shield\nVulnerability scan · severity gates"]:::d1node
        D1_LOCK["🔒  Ecosystem Lock-In Profiler\nAWS · GCP · Vercel · Portability Grade A–F"]:::d1node
        D1_BUG["🩺  Chronic Bug Profiler\nTF-IDF issue clustering · recurring pitfalls"]:::d1node
        D1_HW["🎛️  Edge Hardware Footprint Sizer\nSRAM · Flash · ESP32 · STM32 · Arduino"]:::d1node
        D1_DI["💉  Dependency Injection Profiler\nDI pattern quality · coupling scorer"]:::d1node
        D1_COST["💰  Cloud Cost Forecaster\nAWS · Vercel · Supabase · Neon estimates"]:::d1node
        D1_DOCK["🐳  Docker & Scaffold Synthesizer\nDockerfile · docker-compose · .env.example"]:::d1node
        D1_AST --> D1_GH --> D1_GL --> D1_HN --> D1_CVE
        D1_CVE --> D1_LOCK --> D1_BUG --> D1_HW --> D1_DI --> D1_COST --> D1_DOCK
    end

    %% ═══════════════════════════════════════════════════
    %% TIER 4b — DOMAIN 2: ACADEMIC & DEEP RESEARCH
    %% ═══════════════════════════════════════════════════
    Brain -->|"Research & theory query"| D2

    subgraph D2 ["🔬  DOMAIN 2 — Academic & Deep Research Literature"]
        direction TB
        D2_ARX["📄  arXiv Preprint Engine\nAtom XML · retry backoff · category filter"]:::d2node
        D2_SCH["🎓  Semantic Scholar Literature Client\nCitation counts · abstract summaries"]:::d2node
        D2_PAT["⚖️  Google Patents IP Evasion Tool\nCollision detection · defensive strategy"]:::d2node
        D2_BRG["🔄  Code ↔ Theory Bidirectional Translator\nCode → LaTeX · LaTeX → software template"]:::d2node
        D2_ARX --> D2_SCH --> D2_PAT --> D2_BRG
    end

    %% ═══════════════════════════════════════════════════
    %% TIER 4c — DOMAIN 3: VISUAL DESIGN & UI CANVAS
    %% ═══════════════════════════════════════════════════
    Brain -->|"Design & UI query"| D3

    subgraph D3 ["🎨  DOMAIN 3 — Visual Design & Frontend Canvas"]
        direction TB
        D3_CAN["🌌  Metaphor Canvas Node Graph\nideation-goat://canvas  ·  cognitive-distance edges"]:::d3node
        D3_HYB["🧬  Concept Hybridization Engine\nCross-domain analogy · LaTeX formula · catalyst prompt"]:::d3node
        D3_CAN --> D3_HYB
    end

    D3_CAN -.->|"cache graph"| SessionCache[("💾  In-Memory\nSession Cache")]:::db
    Brain  -.->|"pipeline state"| SessionCache
```

---

## ⚡ Capability Matrix

### 🛠️ 24 Autonomous Tools & Resources

| # | Tool / Resource | Domain | Purpose |
|:--|:-----|:-------|:--------|
| 1 | `ideation-goat://canvas` (Resource) | D3 | Returns the constellation node graph data for the last active search query |
| 2 | `search_knowledge_grid` | D1 & D2 | Multi-domain semantic search with Target and Discovery modes |
| 3 | `breed_concepts` | D3 | Cross-pollinate two paradigms into a hybrid architectural blueprint |
| 4 | `bridge_code_and_theory` | D2 | Bidirectional code ↔ LaTeX mathematical translation |
| 5 | `assess_viability` | D2 | Patent collision detection and defensive evasion strategy |
| 6 | `search_academic_papers` | D2 | Parallel arXiv + Semantic Scholar literature sweep |
| 7 | `write_scaffolding_files` | D1 | Automated project skeleton and boilerplate generator |
| 8 | `verify_workspace_fit` | D1 | License and ecosystem compatibility auditor |
| 9 | `compose_solution_stack` | D1 | Multi-layer architectural decomposition and framework matching |
| 10 | `get_repo_health` | D1 | Real-time GitHub health, stars, and CVE telemetry |
| 11 | `profile_repo_hardware_footprint` | D1 | Edge device SRAM/Flash memory footprint estimation |
| 12 | `align_system_architecture` | D1 | Directory structure pattern detection and alignment scoring |
| 13 | `analyze_workspace_ast` | D1 | Zero-friction offline AST and dependency tree parser |
| 14 | `check_repo_health` | D1 | Supply-chain risk and maintenance health auditor |
| 15 | `check_ecosystem_lockin` | D1 | Vendor lock-in dependency scanner and portability grader |
| 16 | `analyze_repo_bugs` | D1 | TF-IDF semantic clustering of chronic bug patterns |
| 17 | `orchestrate_architectural_workflow` | D1 & D2 | Unified multi-step diagnostic pipeline orchestrator |
| 18 | `forecast_live_costs` | D1 | Cloud hosting cost estimator (AWS, Vercel, Supabase, Neon) |
| 19 | `auto_heal_parameters` | Core | Autonomous parameter type coercion and typo correction |
| 20 | `verify_identity_token` | Core | JWT authentication sandbox with scope verification |
| 21 | `profile_dependency_injection` | D1 | DI pattern quality scanner and modularity scorer |
| 22 | `generate_docker_scaffolding` | D1 | Multi-stage Dockerfile and docker-compose generator |
| 23 | `scan_local_cves` | D1 | OSV.dev vulnerability scanner with severity-based execution gates |
| 24 | `search_gitlab_repos` | D1 | GitLab project registry search integration |
| 25 | `audit_hacker_news_trends` | D1 | Real-time developer sentiment and mention trend auditor |

---

## 📦 Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and populate the required keys (e.g., `LLM_API_KEY` for Gemini, `GITHUB_API_TOKEN`, etc.).

### 3. Build the Project

```bash
npm run build
```

### 4. Run the Server

For development mode (with watch/reload):
```bash
npm run dev
```

For production mode:
```bash
npm start
```

