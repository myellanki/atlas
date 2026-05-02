# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Wouter (routing), TanStack Query, Tailwind CSS, shadcn/ui

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Atlas — Project Management Platform

Full-stack project management tool for VA clinical research (cancer and military exposures).

### Artifacts

- `artifacts/atlas` — React+Vite frontend (preview at `/`)
- `artifacts/api-server` — Express 5 API server (preview at `/api`)

### DB Schema (`lib/db/src/schema/`)

| Table           | Purpose                                      |
|-----------------|----------------------------------------------|
| `teams`         | Research teams                               |
| `members`       | Team members / analysts                      |
| `labels`        | Colored labels for cards                     |
| `cards`         | Project cards (+ `data_source`, `cohort`)    |
| `card_labels`   | Many-to-many card↔label                      |
| `notes`         | Per-card notes/updates                       |
| `checklist`     | Per-card checklist items                     |
| `comments`      | Per-card comments                            |
| `links`         | Per-card external URLs or card references    |
| `activity`      | Audit log                                    |
| `sprints`       | Team sprints (for burndown chart)            |
| `milestones`    | Named research milestones per team           |
| `deliverables`  | Publications/reports linked to cards         |

### API Routes (`artifacts/api-server/src/routes/`)

- `teams`, `members`, `labels`, `cards`, `notes`, `checklist`, `comments`, `links` — standard CRUD
- `dashboard` — summary statistics, team summaries, recent activity
- `gantt` — Gantt bar data per team
- `ai` — AI batch card summary (streaming SSE), AI suggestions
- `sprints` — Sprint CRUD + burndown data
- `milestones` — Team milestone CRUD + cross-team list
- `deliverables` — Card deliverable CRUD + `/publications` dashboard + `/cards/:id/tags` PATCH
- `portfolio` — `/portfolio/utilization` (analyst cross-team Gantt) + `/portfolio/capacity` (weekly heat data)

### Frontend Pages (`artifacts/atlas/src/pages/`)

| Route           | Page                    | Description                                        |
|-----------------|-------------------------|----------------------------------------------------|
| `/`             | Dashboard               | Stats, team summaries, recent activity             |
| `/projects`     | Projects                | AI summaries, Gantt panel, data source/cohort filter |
| `/calendar`     | Calendar                | Due-date calendar view                             |
| `/board/:slug`  | Board                   | Kanban board per team                              |
| `/gantt/:id`    | Gantt                   | Gantt chart + sprint burndown per team             |
| `/labels`       | Labels                  | Label management                                   |
| `/milestones`   | Milestones              | Timeline + CRUD for named research milestones      |
| `/publications` | Publications            | Dashboard of all deliverables grouped by year      |
| `/templates`    | Card Templates          | 4 pre-built checklists; apply to any card          |
| `/portfolio`    | Portfolio (Utilization) | Cross-team analyst Gantt — who's overloaded        |
| `/capacity`     | Capacity Heat Calendar  | Weekly workload heat grid per analyst              |
| `/settings`     | Settings                | App settings                                       |

### Card Detail Drawer

Opened by clicking any card. Contains:
- Title / status / priority / assignee / dates / description
- Checklist (with checklist templates via Card Templates page)
- Links & References (external URL or card-to-card)
- **Data Source & Cohort Tags** (selects VA data source + patient cohort; saved via PATCH /api/cards/:id/tags)
- **Deliverables & Publications** (manuscripts, reports, conference papers; CRUD inline)
- Activity & Notes feed

### Constants

- `DATA_SOURCES`: CDW, VINCI, TriNetX, Cancer Registry, Survey, VA Benefits, External Cohort, Other
- `COHORTS`: Vietnam Veterans, Gulf War, Post-9/11 OEF/OIF, WWII, Korea, General VA, [cancer types], Other
- Milestone types: IRB Submission, Data Access Approved, EDA Complete, Manuscript Submitted, Dissemination, General

### Important Implementation Notes

- New pages (milestones, deliverables, portfolio, capacity, publications) use raw `fetch` calls (not Orval-generated hooks) since they're not in the OpenAPI spec yet
- Do NOT import `zod/v4` directly in API server route files — esbuild cannot resolve it. Import Zod schemas from `@workspace/db` instead, or use plain TypeScript types for request bodies in new routes
- `BASE_URL` pattern: `import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""`
- Card `dataSource`/`cohort` fields exist in Drizzle schema but NOT in the generated OpenAPI types — use `(card as any).dataSource` on the frontend until codegen is updated
