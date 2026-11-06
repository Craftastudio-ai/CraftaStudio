<div align="center">

# ✦ CraftaStudio.ai

**Architecture-first AI code generation.**

[![Phase MVP](https://img.shields.io/badge/Status-Early_Access-18181b?style=flat-square)](https://github.com/pranavgawaii/craftastudio)
[![License MIT](https://img.shields.io/badge/License-MIT-18181b?style=flat-square)](https://opensource.org/licenses/MIT)
[![Stack](https://img.shields.io/badge/Stack-Next.js_|_Fastify_|_Python-18181b?style=flat-square)](https://github.com/pranavgawaii/craftastudio)

*Prompt your architecture. Refine the flow.<br>Let parallel agents build every layer — simultaneously*

---

</div>

<br>

<div align="center">
  <a href="https://docs.google.com/spreadsheets/d/1AFUnAV7H7CLntvOnUyZwQOjjM2YFrGO1gW-n4ofMPF4/edit?usp=sharing" target="_blank">
    <img src="https://img.shields.io/badge/Team%20Activity%20Tracker-Google%20Sheets-34a853?style=for-the-badge&logo=googlesheets&logoColor=white" alt="Team Tracker" />
  </a>
  <p><i>Live task management and parallel execution roadmap.</i></p>
</div>

<br>

## ✧ The Paradigm

Current AI code capabilities are constrained. They generate your API without comprehensive knowledge of your schema, and your UI without awareness of your routes. Every generated piece exists as an isolated island, leaving you to stitch together disjointed code.

**CraftaStudio fundamentally changes this dynamic: the architecture is the input — not the prompt.**

<br>



<br>

## ✧ Execution Flow

```text
Prompt → Planner AI → Canvas Blocks → SharedContext → Parallel Agents → Codebase
```

1. **Prompt** — Describe the system you want to build. 
2. **Plan** — The Planner AI translates your prompt into a visual architecture of interconnected blocks.
3. **Refine** — Review, modify, and manually sculpt the generated architecture on the interactive canvas.
4. **Generate** — Parallel AI agents simultaneously receive the global context and build their respective layers.
5. **Merge** — Complete outputs undergo systematic assembly into a unified, deployment-ready codebase.

<br>

## ✧ Tech Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | Next.js 14, TypeScript, React Flow, Zustand, Tailwind CSS |
| **Backend** | Fastify, PostgreSQL, Prisma ORM, BullMQ, Redis, Zod |
| **Agents** | Python (FastAPI), LangGraph, Anthropic Claude 3.5 |
| **Infra** | Vercel, Railway, Cloudflare R2, Upstash |

<br>

## ✧ Quick Start

**Requirements:** Node 20+, Python 3.11+, PostgreSQL 15+, Redis 7+

```bash
# 1. Clone & environment
git clone https://github.com/Craftastudio-ai/CraftaStudio.git
cd CraftaStudio
cp .env.example .env

# 2. Install dependencies across the workspace
npm run install:all

# 3. Provision the local database
cd backend && npx prisma migrate dev && cd ..

# 4. Spin up the cluster
npm run dev
```
> `npm run install:all` creates `agents/.venv` for the Python service, and `npm run dev` will reuse it automatically.
> Services will boot simultaneously: **Frontend** `:3000` | **Backend** `:3001` | **Agents** `:8000`

<br>

## ✧ Contributing

We maintain a pristine, production-grade repository. Please read our **[Engineering Handbook (CONTRIBUTING.md)](./CONTRIBUTING.md)** before opening a PR.

- **Checkouts:** Always branch from `dev`. 
- **Commits:** Strict conventional commits (e.g., `feat: [feature]`, `fix: [bug]`).
- **Sacred Contract:** Do not modify `shared/types/blocks.ts` without Tech Lead approval.

<br>

## ✧ Team of Craftastudio.ai

- Pranav Gawai
- Vedant kirange
- Jayesh Chaudhari
- Sanika Patil
- Atharva Jadhav
<br>

<div align="center">
  <i>Boilerplate is wasted potential.<br>Prompt the architecture. Refine the blocks. Get the codebase.</i>
</div>
