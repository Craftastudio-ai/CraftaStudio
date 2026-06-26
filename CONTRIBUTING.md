# ✦ Engineering & Contribution Handbook

Welcome to **CraftaStudio**. This guide is the single source of truth for our architecture, onboarding, and rigorous engineering standards. We build with an **architecture-first** mindset.

---

## ✧ 1. Onboarding & Setup

We optimize for a "zero to ready" time of under 5 minutes. Use the workspace-level commands provided in the `package.json`.

### Prerequisites
- **Node.js**: 20+
- **Python**: 3.11+
- **Postgres**: 15+
- **Redis**: 7+

### Rapid Cluster Launch
```bash
# 1. Environment & Secrets
cp .env.example .env
# Fill .env with keys for Clerk, Anthropic, Redis, and Database.

# 2. Workspace Installation
# Installs Frontend, Backend, and Agent dependencies.
npm run install:all

# 3. Database Bootstrap
cd backend && npx prisma migrate dev && cd ..

# 4. Spin up the Stack
# Runs Frontend (3000), Backend (3001), and Agents (8000) concurrently.
npm run dev
```

---

## ✧ 2. System Architecture

CraftaStudio operates on a **Shared Global Context** model. Our motto: *The architecture is the input — not just the prompt.*

### The Flow
`User Prompt → Planner AI → Visual Blocks (DAG) → Unified Context → Concurrent Agents → Merged Source`

- **The Graph (DAG)**: Projects are represented as visual blocks. We use Kahn's algorithm to ensure zero circular dependencies.
- **SharedContext**: The Planner AI produces a "Global Blueprint". Every generator (DB, API, UI) reads this exact state to ensure the final codebase is cohesive.
- **Merge Engine**: Collects parallel outputs, structures the filesystem, and prepares a deployment-ready bundle.

---

## ✧ 3. Development Workflow

We maintain a pristine repository. Every line of code should feel like it was written by a single, highly-competent engineer.

### Branching Strategy
- **`main`**: Production-ready code only.
- **`dev`**: The active integration branch. **All PRs target `dev`.**
- **Branch Prefix**: Use `feature/`, `fix/`, `refactor/`, or `docs/`.

### Conventional Commits
We enforce strict semantic commit messages. This allows for automated changelog generation.
- `feat:` — New feature for the user (not a refactor).
- `fix:` — Bug fix for the user.
- `docs:` — Documentation changes only.
- `chore:` — Infrastructure, lockfile updates, or housekeeping.

### Pull Request Expectations
- **Atomic PRs**: One logic unit per PR.
- **Local Validation**: Run `npm run type-check` before pushing.
- **The "2-Hour Rule"**: If you are stuck for more than 2 hours, stop and ping the team. No heroics — we solve blockers together.

---

## ✧ 4. Engineering Standards

### 4.1. Strict Type Safety
- **TypeScript**: `strict: true` is mandatory. Do not use `@ts-ignore`.
- **No `any`**: Use `unknown` or explicit interfaces.
- **Zod Proofing**: No type assertions (`as Type`) without a Zod schema validation first.

### 4.2. The Sacred Shared Contract
Files in `/shared` (especially `types/blocks.ts`) are the "Laws of the Workspace". They define the interface between Frontend, Backend, and AI. **Never modify these without team consensus.**

### 4.3. Operational Excellence
- **Logging**: No `console.log` in production folders. Use the Fastify/Python loggers.
- **Validation**:
  - **Backend (TS)**: All request bodies must be parsed via **Zod**.
  - **Agents (Python)**: All payloads must be parsed via **Pydantic**.
- **Error Handling**: Never let a `catch` block fail silently. Use explicit, typed error responses: `{ error: string, code: string }`.

---

> [!NOTE]
> CraftaStudio is in **Early Access**. Patterns move fast. If you see a way to improve this handbook, open a PR.
