# Dispatch and Routing Engine — Implementation Plan

---

## Project Summary (from CLAUDE.md & TypeScript_Tech_Stack.md)

**Project:** Dispatch and Routing Engine  
**Purpose:** Assign and sequence same-day pickup/delivery stops for P&D drivers so terminal dispatchers can commit to a plan in the morning and re-cut it as the day moves.  
**Consumers:** Dispatchers (browser), drivers (mobile), CLI (upstream shipment/stop data).  
**Scale:** 2,000 stops/day, 5 terminals, 100 tractors, 12 concurrent dispatchers at 6–8am peak, 1.5M shipment records retained.

### Hard Constraints

- **Auditability:** Every assignment/resequence logged with actor, timestamp, prior state, reason code.
- **Performance:** Full terminal replan < 5 seconds.
- **HOS Compliance:** Engine never emits HOS-violating plan; dispatcher may override.
- **CLI System of Record:** Engine reads from CLI, never writes rated/billing fields.
- **Offline Tolerance:** Driver devices tolerate 180 min offline; queue reconciles on reconnect.
- **Override Persistence:** Manual overrides persist; engine may recommend against, never silently revert.

### Out of Scope

Rating/invoicing, interline tendering, customer-facing ETA portal, driver payroll, linehaul/network design.

### Tech Stack (P4 — Realtime Engine)

- **Runtime:** Fastify + TypeScript strict, ESM. Zod at every boundary.
- **Realtime:** Socket.IO with Redis adapter (required past one instance).
- **Data:** Postgres + PostGIS via Prisma; raw SQL where query plan matters. Redis for presence, locks, hot state.
- **Durable Work:** RabbitMQ or BullMQ (never node-cron on multi-replica).
- **Architecture:** State changes are events first, projections second. Replayable or it didn't happen.
- **Observability:** OpenTelemetry spans across queue boundary, Pino structured logs.

---

## Current Repository State

### Workspace Structure

```
.
├── package.json                 # @dispatch/api (root package)
├── pnpm-workspace.yaml
├── tsconfig.json                # Root config with path aliases
├── packages/
│   ├── shared/                  # @dispatch/shared - domain types, Zod schemas, utilities
│   │   ├── src/
│   │   │   ├── types/index.ts   # TypeScript interfaces
│   │   │   ├── schemas/index.ts # Zod validation schemas
│   │   │   ├── utils/index.ts   # Distance, formatting, time-window helpers
│   │   │   └── index.ts         # Barrel export
│   │   ├── tests/               # Unit tests (33 tests, 1 failing)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── api/                     # @dispatch/api - Fastify REST + Socket.IO server
│       ├── prisma/schema.prisma # Complete domain models
│       ├── src/
│       │   ├── app.ts           # Fastify app builder
│       │   ├── index.ts         # Entry point
│       │   ├── plugins/         # Prisma, Socket.IO
│       │   ├── routes/          # CRUD for all 7 entities
│       │   └── utils/audit.ts   # Audit log helpers
│       ├── tests/setup.ts       # Test setup (empty)
│       ├── vitest.config.ts
│       └── tsconfig.json
└── .github/                     # (none yet)
```

### Git History (Chronological)

| Commit  | Message                                                                       | Phase | Notes                                                  |
| ------- | ----------------------------------------------------------------------------- | ----- | ------------------------------------------------------ |
| 042d00b | Adding Project Instructions                                                   | —     | Initial CLAUDE.md, tech stack docs                     |
| c9c6690 | chore: set up project foundation with pnpm workspace, TypeScript, and linting | 1     | Root config, eslint, prettier, husky                   |
| 8105c08 | feat: add shared package with domain types, Zod schemas, and utilities        | 2     | Types, schemas, utils, barrel export                   |
| 3e98244 | test: add Phase 2 domain model and schema test cases                          | 2     | 33 unit tests for types/schemas/utils                  |
| bf34ef7 | fix: resolve tsconfig extends path error in root config                       | 1/2   | Fixed tsconfig references                              |
| 7ba496c | feat: add Fastify API package with Prisma schema and CRUD routes              | 2/3   | Prisma schema, 7 route modules, Socket.IO, audit utils |

**HEAD:** `7ba496c` (main), 3 commits ahead of origin/main.

### Uncommitted Changes

- `.gitignore` — expanded with standard patterns
- `package.json` — removed `@fastify/socket.io` (unused)
- `pnpm-workspace.yaml` — added `allowBuilds` for native deps
- `tsconfig.json` — reverted to root config (was API config)

---

## Phase 1 — Project Foundation

### Goal

Establish monorepo tooling, TypeScript strict config, linting, formatting, and Git hooks.

### Requirements Covered

- CLAUDE.md: Stack profile P4, commands, workflow rules
- TypeScript_Tech_Stack.md: TypeScript strict from first commit, pnpm, Turborepo, ESLint flat config, Prettier, Husky

### Implementation (Completed)

- pnpm workspace with `packages/*` and `apps/*`
- Root `tsconfig.json` with `strict: true`, `composite: true`, path aliases for `@dispatch/shared`
- ESLint flat config (`eslint.config.js`) with `typescript-eslint`, type-aware rules
- Prettier config (minimal)
- Husky pre-commit hook with `lint-staged`
- `.gitignore` with comprehensive patterns

### Components / Files

- `package.json` (root, now `@dispatch/api`)
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `eslint.config.js`, `prettier.config.js`, `lint-staged.config.js`
- `.husky/pre-commit`
- `.gitignore`

### Tests

- None (infrastructure only)

### Completion Criteria

- [x] `pnpm install` succeeds
- [x] `pnpm typecheck` passes (root config)
- [x] `pnpm lint` passes
- [x] `pnpm build` works for all packages

### Status: **Completed**

---

## Phase 2 — Domain Model, Schemas & Validation

### Goal

Define complete domain types, Zod validation schemas, and utility functions with full test coverage.

### Requirements Covered

- CLAUDE.md: Auditability (types include all audit fields), HOS status enum, CLI read-only (billingFields, rated)
- TypeScript_Tech_Stack.md: Zod at every boundary, infer types from schemas, `.strict()` on inbound

### Implementation (Completed with Issues)

**Packages:**

- `@dispatch/shared` — types, schemas, utilities

**Types (`packages/shared/src/types/index.ts`):**

- Terminal, Tractor, Driver, Shipment, Stop, Route, Assignment, AuditLog
- Enums: HOSStatus, StopStatus, RouteStatus, Priority, StopType

**Zod Schemas (`packages/shared/src/schemas/index.ts`):**

- All 8 entity schemas with proper validation (UUID, ranges, enums)
- Coordinate bounds, VIN length, date objects

**Utilities (`packages/shared/src/utils/index.ts`):**

- `calculateDistance` (Haversine, miles)
- `formatDuration` (minutes → "Xh Ym")
- `isWithinTimeWindow` (inclusive bounds)

**Tests (`packages/shared/src/**/*.test.ts`):**

- 8 type instantiation tests
- 13 schema validation tests (happy + reject paths)
- 12 utility tests (edge cases, boundaries)
- **Total: 33 tests, 1 failing**

### Problems Found

| Issue                                                                                                                  | Location                       | Severity                  |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------- |
| Distance test expects 2451mi (NYC→LA), actual 2445.6mi                                                                 | `utils/index.test.ts:9`        | Low (test constant wrong) |
| Root `package.json` missing `@sinclair/typebox`, `@fastify/type-provider-typebox`, `@socket.io/redis-adapter`, `redis` | `package.json`                 | High (blocks typecheck)   |
| TypeScript errors: `request.query/params/body` typed as `unknown` in all routes                                        | `packages/api/src/routes/*.ts` | High (blocks typecheck)   |
| `socket.ts` references `app.io.engine.adapter` which doesn't exist on `Server` type                                    | `health.ts:42`                 | Medium                    |
| ESLint config fails: missing `@eslint/js` package                                                                      | `eslint.config.js`             | Medium                    |
| No `packages/api/package.json` — root package.json serves as API package                                               | Workspace structure            | Medium (unconventional)   |

### Components / Files

- `packages/shared/src/types/index.ts`
- `packages/shared/src/schemas/index.ts`
- `packages/shared/src/utils/index.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/types/index.test.ts`
- `packages/shared/src/schemas/index.test.ts`
- `packages/shared/src/utils/index.test.ts`
- `packages/api/prisma/schema.prisma` (213 lines, complete)
- `packages/api/src/utils/audit.ts`

### Tests Required

- [x] Type instantiation for all 8 entities + 4 enums
- [x] Schema validation: happy path + at least one reject per entity
- [x] Utility functions: boundaries, edge cases, invalid input

### Completion Criteria

- [x] All 33 shared tests pass
- [x] `pnpm --filter @dispatch/shared typecheck` passes
- [x] `pnpm --filter @dispatch/shared lint` passes
- [x] `pnpm --filter @dispatch/api typecheck` passes
- [x] `pnpm --filter @dispatch/api lint` passes
- [x] `pnpm build` passes for all packages

### Dependencies

- Phase 1

### Status: **Completed**

---

## Phase 3 — Fastify API & CRUD Endpoints

### Goal

Implement REST API with Fastify, Socket.IO realtime, Prisma ORM, and full CRUD for all 7 domain entities.

### Requirements Covered

- CLAUDE.md: 5-second replan target (API foundation), auditable assignments (assignment routes), CLI read-only (no billing/rated writes)
- TypeScript_Tech_Stack.md: Fastify schema-first, Socket.IO with Redis adapter, Prisma, Pino, OpenTelemetry

### Implementation (Partially Complete)

**Routes Implemented (7 modules, ~1000 lines):**

- `health.ts` — `/health`, `/health/ready` (DB + Redis check)
- `terminals.ts` — CRUD + realtime events
- `tractors.ts` — CRUD + realtime events
- `drivers.ts` — CRUD + realtime events, filter by terminal
- `shipments.ts` — CRUD + realtime events, filter by terminal/priority
- `stops.ts` — CRUD + realtime events, filter by shipment/status
- `routes.ts` — CRUD + realtime events, filter by terminal/tractor/driver/status
- `assignments.ts` — CRUD + realtime events, auto-updates stop status

**Plugins:**

- `prisma.ts` — PrismaClient decorator, query logging in dev
- `socket.ts` — Socket.IO with Redis adapter (optional), terminal rooms

**App Builder (`app.ts`):**

- Helmet, CORS, Rate-limit (100/min)
- Prisma + Socket.IO plugins
- All 7 route modules registered with prefixes

**Realtime Events Emitted:**

- `terminal:created/updated/deleted`
- `tractor:created/updated/deleted`
- `driver:created/updated/deleted`
- `shipment:created/updated/deleted`
- `stop:created/updated/deleted`
- `route:created/updated/deleted`
- `assignment:created/deleted`

### Problems Found (Resolved in Phase 2 Repair)

| Issue                                                                       | Location                  | Status     |
| --------------------------------------------------------------------------- | ------------------------- | ---------- |
| Missing dependencies block TypeScript compilation                           | `package.json`            | ✅ Fixed   |
| Fastify TypeBox provider not installed; `request.query/params/body` untyped | All routes                | ✅ Fixed   |
| Socket.IO Redis adapter optional but health check assumes it                | `socket.ts`, `health.ts`  | ✅ Fixed   |
| No audit log creation on mutations (audit.ts unused)                        | All routes                | ✅ Fixed   |
| No HOS validation on driver/route creation                                  | `drivers.ts`, `routes.ts` | ⏳ Pending |
| No input sanitization beyond Zod/TypeBox                                    | All routes                | ⏳ Pending |
| No integration/e2e tests                                                    | `packages/api/tests/`     | ⏳ Pending |

### Components / Files

- `packages/api/src/app.ts`
- `packages/api/src/index.ts`
- `packages/api/src/plugins/prisma.ts`
- `packages/api/src/plugins/socket.ts`
- `packages/api/src/routes/*.ts` (7 files)
- `packages/api/src/utils/audit.ts`
- `packages/api/prisma/schema.prisma`

### Tests Required

- [ ] Unit tests for each route (happy path, 404, validation error)
- [ ] Integration tests with Testcontainers (Postgres, Redis)
- [ ] Realtime event emission verification
- [ ] Audit log creation on every mutation
- [ ] HOS violation rejection on route creation

### Completion Criteria

- [ ] `pnpm --filter @dispatch/api typecheck` passes
- [ ] `pnpm --filter @dispatch/api lint` passes
- [ ] `pnpm --filter @dispatch/api test` passes (unit + integration)
- [ ] `pnpm --filter @dispatch/api build` passes
- [ ] Manual API test: CRUD cycle for each entity + realtime events received

### Dependencies

- Phase 2 (Completed)

### Status: **Pending**

---

## Phase 4 — Routing Engine Core

### Goal

Implement the optimization engine that assigns and sequences stops to routes respecting HOS, time windows, and capacity.

### Requirements Covered

- CLAUDE.md: 5-second replan, HOS compliance, auditability, override persistence
- TypeScript_Tech_Stack.md: Raw SQL for query plans, PostGIS for geospatial, event-sourced state changes

### Implementation (Not Started)

#### 4.1 — Data Access & Projections

- **Prisma extensions** for common queries (stops by terminal/window, driver HOS)
- **PostGIS integration** for distance/duration lookups (replace Haversine)
- **Materialized views** for terminal stop clusters

#### 4.2 — Constraint Solver

- **HOS Engine**: 70-hr/8-day, 11-hr driving, 14-hr on-duty, 30-min break after 8hr
- **Time Window Engine**: Hard/soft windows, earliest/latest arrival, wait time
- **Capacity Engine**: Weight/volume per tractor, axle limits

#### 4.3 — Optimization Algorithm

- **Initial Solution**: Greedy insertion (nearest neighbor + time window feasibility)
- **Improvement**: 2-opt, Or-opt, relocation, exchange
- **Metaheuristic**: Simulated annealing or ALNS for 2000 stops < 5s
- **Multi-objective**: Minimize distance, maximize priority fulfillment, balance driver hours

#### 4.4 — Replan API

- `POST /routes/replan?terminalId={id}` — full terminal replan
- `POST /routes/{id}/resequence` — single route resequence
- Returns: new route plan + audit log entries + diff vs current
- **Response time SLA**: < 5 seconds (measured in tests)

#### 4.5 — Event Sourcing

- Every assignment/resequence → `AssignmentEvent` in event store
- Projections: RouteView, DriverScheduleView, TerminalBoardView
- Replay capability for disaster recovery

### Components / Files (Planned)

- `packages/engine/` — new package for routing core
  - `src/constraints/hos.ts`
  - `src/constraints/time-windows.ts`
  - `src/constraints/capacity.ts`
  - `src/solver/greedy.ts`
  - `src/solver/local-search.ts`
  - `src/solver/metaheuristic.ts`
  - `src/replan/service.ts`
  - `src/events/assignment-event.ts`
  - `src/projections/*.ts`
- `packages/api/src/routes/replan.ts` — replan endpoints
- `packages/api/prisma/schema.prisma` — add EventStore model

### Tests Required

- [ ] HOS engine: 70-hr cycle, 11/14-hr limits, break rules
- [ ] Time window: hard/soft, wait time, infeasibility detection
- [ ] Greedy insertion: feasibility, determinism
- [ ] Local search: 2-opt improves distance, preserves feasibility
- [ ] Metaheuristic: 2000 stops < 5s, quality vs greedy
- [ ] Replan API: audit log created, diff correct, HOS never violated
- [ ] Override persistence: manual assignment survives replan
- [ ] Replay: event store → projections match live state

### Completion Criteria

- [ ] `pnpm --filter @dispatch/engine test` passes
- [ ] `pnpm --filter @dispatch/engine typecheck` passes
- [ ] Replan benchmark: 2000 stops, 100 tractors, 5 terminals < 5s (p95)
- [ ] HOS violation test: engine rejects, dispatcher can override (flagged)
- [ ] Event replay test: full rebuild from events matches DB

### Dependencies

- Phase 3

### Status: **Pending**

---

## Phase 5 — Driver Mobile Sync & Offline Queue

### Goal

Enable driver mobile app to receive routes, complete stops offline (180 min), and reconcile on reconnect.

### Requirements Covered

- CLAUDE.md: Coast runs lose signal, 180 min offline tolerance, queue reconciles on reconnect

### Implementation (Not Started)

#### 5.1 — Route Assignment Push

- Socket.IO event `route:assigned` → driver device
- Payload: full route with stops, time windows, navigation links
- Acknowledgment required; retry with exponential backoff

#### 5.2 — Offline Stop Completion Queue

- Local IndexedDB (web) / SQLite (native) on device
- Queue entries: stopId, completedAt, GPS coords, photos, signature
- Max 180 min offline; persisted across app restarts

#### 5.3 — Reconnection Reconciliation

- On reconnect: `POST /sync` with queued completions
- Server: validate sequence, update stop status, create audit logs
- Conflict resolution: server wins on sequence, client wins on completion data
- Idempotent: duplicate deliveries detected via `stopId + completedAt`

#### 5.4 — Real-time Driver Tracking

- Socket.IO `driver:location` updates (throttled 30s)
- Terminal board shows live driver positions
- ETA recalculation on significant deviation

### Components / Files (Planned)

- `packages/mobile-sync/` — shared sync protocol types
- `packages/api/src/routes/sync.ts` — reconciliation endpoint
- `packages/api/src/plugins/driver-tracking.ts` — location handling
- `packages/api/prisma/schema.prisma` — add `StopCompletion` model

### Tests Required

- [ ] Offline queue: 180 min persistence, survives restart
- [ ] Reconciliation: valid sequence accepted, invalid rejected
- [ ] Idempotency: duplicate sync payload handled
- [ ] Conflict: server sequence + client completion data merged
- [ ] Load: 100 drivers syncing simultaneously < 2s

### Completion Criteria

- [ ] `pnpm --filter @dispatch/mobile-sync test` passes
- [ ] Integration test: offline → online → state consistent
- [ ] Manual test: driver app completes stops offline, syncs on reconnect

### Dependencies

- Phase 3 (API foundation)

### Status: **Pending**

---

## Phase 6 — Dispatcher Dashboard (Web)

### Goal

Browser-based dispatch board for 12 concurrent dispatchers at peak.

### Requirements Covered

- CLAUDE.md: Primary consumer is dispatchers in browser; commit plan in morning, re-cut during day
- TypeScript_Tech_Stack.md: P2 profile (Vite + React + TanStack Query + Tailwind + shadcn)

### Implementation (Not Started)

#### 6.1 — Tech Setup

- New app: `apps/dashboard/`
- Vite + React 18 + TypeScript strict
- TanStack Query for server state
- Tailwind + shadcn/ui components
- Socket.IO client for realtime updates

#### 6.2 — Core Views

- **Terminal Board**: All routes for terminal, drag-drop resequence
- **Route Detail**: Stop list, timeline, HOS status, map view
- **Stop Manager**: Unassigned stops pool, filter by window/priority
- **Driver Panel**: HOS remaining, current location, assigned route
- **Replan Dialog**: One-click terminal replan with preview/diff

#### 6.3 — Interactions

- Drag-drop stop reorder → optimistic UI → `PATCH /routes/{id}/resequence`
- Assign stop to route → `POST /assignments`
- Override HOS warning → `POST /assignments` with `reasonCode: OVERRIDE_HOS`
- Manual override flag persists; engine shows warning but doesn't revert

#### 6.4 — Real-time Updates

- Subscribe to `terminal:{id}` room
- Live updates: route changes, driver location, stop completions
- Conflict toast: "Another dispatcher modified this route — refresh?"

### Components / Files (Planned)

- `apps/dashboard/` — complete React app
- `packages/shared/src/api-client.ts` — typed API client (generated from OpenAPI)

### Tests Required

- [ ] Component tests: board, route detail, stop manager
- [ ] Integration: drag-drop → API call → realtime update → board reflects
- [ ] Override flow: HOS warning shown, override recorded, persists through replan
- [ ] Concurrency: 2 dispatchers same terminal, conflict detection

### Completion Criteria

- [ ] `pnpm --filter @dispatch/dashboard build` passes
- [ ] `pnpm --filter @dispatch/dashboard test` passes
- [ ] Manual: 2 dispatchers, same terminal, concurrent edits handled

### Dependencies

- Phase 3 (API), Phase 4 (replan API)

### Status: **Pending**

---

## Phase 7 — Observability & Operations

### Goal

Production-grade observability, migrations, seeding, and deployment configs.

### Requirements Covered

- CLAUDE.md: Commands (migrate, seed, e2e), OpenTelemetry, Pino
- TypeScript_Tech_Stack.md: Docker Compose for local, OpenTelemetry spans across queue boundary

### Implementation (Not Started)

#### 7.1 — Observability

- OpenTelemetry: HTTP in, DB out, queue publish/consume, replan spans
- Pino: structured JSON, `redact` for PII, request ID binding
- Metrics: replan latency (p50/p95/p99), API latency, error rates, queue depth
- Health: `/health/ready` checks DB, Redis, queue

#### 7.2 — Database Operations

- Prisma migrations (versioned, never edit applied)
- Seed script: 5 terminals, 100 tractors, 200 drivers, sample shipments
- `pnpm --filter @dispatch/api prisma migrate dev`
- `pnpm --filter @dispatch/api prisma db seed`

#### 7.3 — Local Development

- `docker-compose.yml`: Postgres + PostGIS, Redis, RabbitMQ
- `pnpm dev` starts API + dashboard (concurrently)

#### 7.4 — CI/CD

- GitHub Actions: typecheck, lint, test, build on every PR
- pnpm store caching
- Required checks on protected `main` branch

### Components / Files (Planned)

- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `packages/api/prisma/seed.ts`
- `packages/api/src/observability/` — OTEL setup, metrics

### Tests Required

- [ ] Migration: up/down works, no data loss
- [ ] Seed: deterministic, idempotent
- [ ] Health endpoint: reports correct dependency status
- [ ] OTEL: trace context propagates across queue boundary

### Completion Criteria

- [ ] `pnpm --filter @dispatch/api migrate` works locally
- [ ] `pnpm --filter @dispatch/api seed` works locally
- [ ] `docker-compose up` starts all dependencies
- [ ] CI passes on PR

### Dependencies

- Phase 3 (API), Phase 4 (engine has queue)

### Status: **Pending**

---

## Phase 8 — Hardening & Edge Cases

### Goal

Address all "Definition of Done" requirements: timeout/retry/duplicate handling, boundary validation, regression tests.

### Requirements Covered

- CLAUDE.md: New async/I/O path → state timeout/retry/duplicate; new input boundary → validated + reject test; behavior change → docs updated

### Implementation (Not Started)

#### 8.1 — Resilience Patterns

- **API**: Timeout on Prisma queries (5s), circuit breaker on external calls
- **Queue**: BullMQ/RabbitMQ with explicit retry policy, backoff, max retries, DLQ
- **Replan**: Idempotency key, duplicate request detection
- **Socket.IO**: Ping/timeout config, reconnection with exponential backoff

#### 8.2 — Boundary Validation

- All route handlers: Zod schema on body/query/params (already TypeBox, add Zod)
- Webhook endpoints (future): Zod + signature verification
- CLI ingestion: Zod validate every payload; malformed → dead-letter

#### 8.3 — Regression Tests

- HOS violation never emitted (property-based test)
- Audit log created for every mutation (integration test)
- Override persists through replan (scenario test)
- Offline queue reconciliation (integration test)
- Replan < 5s under load (benchmark test)

#### 8.4 — Documentation

- SPEC.md (source of truth for behavior)
- ADRs in `/docs` for routing algorithm choices
- API docs via OpenAPI (generated from Fastify schemas)

### Components / Files (Planned)

- `docs/adr/*.md`
- `SPEC.md`
- `packages/api/src/middleware/validation.ts`
- `packages/api/src/middleware/idempotency.ts`
- `packages/api/src/queue/` — BullMQ workers

### Tests Required

- [ ] Property test: 1000 random route plans, zero HOS violations
- [ ] Chaos test: kill replan mid-execution, replay from events
- [ ] Load test: 12 dispatchers concurrent replan, all < 5s
- [ ] Duplicate delivery: same stop completed twice → one audit log

### Completion Criteria

- [ ] All regression tests pass
- [ ] Benchmark: replan p95 < 5s at scale
- [ ] SPEC.md matches implementation (subagent review)
- [ ] OpenAPI spec generated and accurate

### Dependencies

- Phase 4, Phase 5, Phase 6, Phase 7

### Status: **Pending**

---

## Summary: Phase Status

| Phase | Name                               | Status        |
| ----- | ---------------------------------- | ------------- |
| 1     | Project Foundation                 | **Completed** |
| 2     | Domain Model, Schemas & Validation | **Completed** |
| 3     | Fastify API & CRUD Endpoints       | **Pending**   |
| 4     | Routing Engine Core                | **Pending**   |
| 5     | Driver Mobile Sync & Offline Queue | **Pending**   |
| 6     | Dispatcher Dashboard (Web)         | **Pending**   |
| 7     | Observability & Operations         | **Pending**   |
| 8     | Hardening & Edge Cases             | **Pending**   |

---

## Immediate Next Steps (Phase 2 Repair — **Completed**)

All repair items have been completed and verified:

1. ✅ **Fix failing test** — Updated NYC→LA distance expectation in `packages/shared/src/utils/index.test.ts:9` to `toBeCloseTo(2446, -1)`.
2. ✅ **Add missing dependencies** — Added `@sinclair/typebox`, `@fastify/type-provider-typebox`, `@socket.io/redis-adapter`, `redis`, `@eslint/js`, `typescript-eslint` to `package.json`.
3. ✅ **Fix TypeScript types in routes** — Extracted schema constants and added type assertions for `request.query/params/body` in all 7 route modules.
4. ✅ **Fix ESLint config** — Added `typescript-eslint` package, fixed flat config, auto-fixed `import type` issues.
5. ✅ **Add audit log creation** — Integrated `createAuditLog` calls in every POST/PUT/DELETE handler across all 7 route modules.
6. ✅ **Run verification** — All commands pass:
   ```bash
   pnpm test              # 33 tests pass
   pnpm typecheck         # Passes
   pnpm lint              # Passes
   pnpm build             # All packages build
   ```

Phase 2 → **Completed**. Ready for Phase 3.

---

## Recommended Next Phase

**Phase 3** (Fastify API & CRUD) — The API foundation is solid with type-safe routes, audit logging, and realtime events. Next steps:

- Add unit tests for each route (happy path, 404, validation error)
- Add integration tests with Testcontainers (Postgres, Redis)
- Implement HOS validation on driver/route creation
- Add input sanitization beyond Zod/TypeBox

---

_Generated from repository analysis on 2026-08-19. This plan is the durable source of truth for project progress._
