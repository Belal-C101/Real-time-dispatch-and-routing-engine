# TypeScript Tech Stack

> **How to read this.**
> - **Stack profiles** — paste-ready blocks for the `# Stack` section of CLAUDE.md.
> - **Reference systems** — real, publicly-inspectable projects at three sizes.
>   Find the one shaped like yours and steal its shape.
> - **Tool catalog** — what each tool is, when a senior dev reaches for it, and
>   when they don't. The "skip" line is the important one: most stack rot comes
>   from adding a package the runtime already replaced.
>
> **On the reference systems:** all are open source, so the stacks are drawn from
> their public repositories and documentation rather than hearsay. Open-source
> stacks move fast and several of these have rearchitected at least once — treat
> the entries as "the shape this system settled on," and check the repo before
> quoting specifics.

---

# Stack profiles

Copy one block into `# Stack` in CLAUDE.md. Deviating is fine; state the reason.

### P1 — Content / marketing site

```
- Next.js (App Router) + TypeScript strict, Tailwind, shadcn.
- Content: MDX + gray-matter, or a headless CMS. No database unless proven.
- Forms: React Hook Form + Zod, posted to a route handler.
- Deploy: Vercel or Cloudflare Pages. No container, no queue, no Redis.
```

### P2 — Internal tool / admin dashboard

```
- Vite + React + TypeScript strict, Tailwind, shadcn, TanStack Query.
- API: Fastify + Zod. Postgres via Prisma. Auth via the company IdP.
- No SSR. It's behind a login; first paint doesn't matter, iteration speed does.
- Deploy: one container. Logs to Pino, nothing else.
```

### P3 — SaaS product (the common default)

```
- Turborepo + pnpm monorepo, TypeScript strict, ESM.
- Web: Next.js, Tailwind, shadcn, React Hook Form + Zod.
- API: tRPC in-repo, or Fastify + Zod if non-TS clients exist.
- Data: Postgres + Prisma. Redis for sessions, cache, rate limits.
- Background: BullMQ workers as a separate deployable from day one.
- Observability: Pino + OpenTelemetry. Tests: Vitest + Supertest + Playwright.
```

### P4 — Realtime engine (dispatch, tracking, live boards)

```
- Fastify + TypeScript strict, ESM. Zod at every boundary.
- Realtime: Socket.IO with the Redis adapter (required past one instance).
- Data: Postgres (+ PostGIS if geospatial) via Prisma; raw SQL where the
  query plan matters. Redis for presence, locks, and hot state.
- Durable work: RabbitMQ or BullMQ. Never node-cron on multi-replica.
- State changes are events first, projections second. Replayable or it didn't happen.
- Observability: OpenTelemetry spans across the queue boundary, Pino structured logs.
```

### P5 — Queue / worker service

```
- No HTTP surface except /health and /metrics. Fastify if you need one.
- Consumer: RabbitMQ or BullMQ. Handlers idempotent, keyed on a message ID.
- Zod-validate every payload; malformed → dead-letter, don't crash the consumer.
- Explicit retry policy with backoff and a maximum. DLQ is monitored, not decorative.
- Postgres via Prisma. Redis for locks.
```

### P6 — CLI or published library

```
- TypeScript strict, ESM (+ CJS via tsup if consumers need it).
- CLI: cleye or yargs, execa for subprocesses, ansis for output.
- Build: tsup. Dev: tsx. Release: Changesets (monorepo) or release-it (single).
- Tests: Vitest. Docs: TypeDoc for API surface, README for everything else.
- Zero runtime dependencies is a feature. Every one you add, your users install.
```

### P7 — Edge API

```
- Hono + TypeScript strict. Zod for validation.
- Data: whatever speaks HTTP from the edge — Postgres over a pooler, or a
  managed KV/D1. No long-lived connections; the runtime will kill them.
- No Node built-ins that aren't in the Workers runtime. Check before importing.
- Deploy: Cloudflare Workers / Pages, or Vercel Edge.
```

---

# Reference systems

## What size are you actually building?

| | Small | Medium | Large |
|---|---|---|---|
| People | 1–2 | 3–10 | 10+ |
| Deployables | 1 | 2–4 (api, worker, web) | many, plus platform |
| Data stores | 1 | 2–3 | many, incl. purpose-built |
| The real constraint | Shipping at all | Not tripping over each other | Change without breakage |
| Biggest risk | Over-engineering | Under-engineering | Coupling |

The most expensive mistake at each size: small teams building for a scale
they'll never hit; medium teams still running everything in one process;
large teams sharing a database between teams that don't talk.

---

## Small — one deployable, 1–2 developers

**Uptime Kuma** — self-hosted uptime and status monitoring.
- Stack: Node.js + Express, Socket.IO for the live dashboard, SQLite (MariaDB
  optional at scale), Vue frontend, ships as a single Docker container.
- Shape: one process does the checks, the storage, and the websocket push.
- Steal this: a live dashboard does not require a queue, Redis, or a second
  service. One process plus Socket.IO is a complete realtime product.

**Umami** — privacy-focused web analytics.
- Stack: Next.js, Prisma, Postgres or MySQL.
- Shape: a single Next app serves both the tracking endpoint and the dashboard.
- Steal this: the write path and the read path can share one deployable for a
  long time. Split them when the write volume proves it, not before.

**Excalidraw** — collaborative virtual whiteboard.
- Stack: React + TypeScript + Vite, canvas rendering, local-first storage; a
  small separate room server handles collaboration.
- Shape: the application is fully functional with no backend at all.
- Steal this: local-first. Make the offline case the default path and the sync
  server an addition, and you get resilience for free instead of retrofitting it.

**Dub** — link shortener with click analytics.
- Stack: Next.js App Router, Prisma with a MySQL-compatible database, Redis for
  hot redirect lookups, a purpose-built analytics store for click events.
- Shape: the redirect path is deliberately the cheapest code in the system.
- Steal this: when one route carries 99% of traffic, give it its own datastore
  path. Don't make a redirect wait on your OLTP database.

**Hoppscotch** — API development client.
- Stack: Vue/Nuxt frontend; a NestJS + Prisma + Postgres backend added later for
  teams and sharing.
- Shape: began with no server at all — everything in browser storage.
- Steal this: the backend arrived only when a feature genuinely required one.
  That sequencing is a choice, and it's usually the right one.

**Typebot / Formbricks** — conversational form and survey builders.
- Stack: Next.js, Prisma, Postgres, Tailwind, both organized as small monorepos.
- Shape: builder app, public runtime, shared package.
- Steal this: Next + Prisma + Postgres + Tailwind is the actual industry default
  for a small product. Choosing it costs you no explanation; choosing against it
  should cost you one.

---

## Medium — a few deployables, a small team

**Cal.com** — scheduling infrastructure.
- Stack: Turborepo + pnpm monorepo, Next.js, tRPC, Prisma, Postgres, Tailwind,
  NextAuth, extensive third-party calendar integrations.
- Shape: one monorepo, several apps, a shared package boundary between them.
- Steal this: tRPC pays off precisely because client and server live in one
  repo and ship together. Outside that condition it's a liability, not a feature.

**Documenso** — open-source document signing.
- Stack: Next.js, tRPC, Prisma, Postgres, Turborepo, Tailwind.
- Shape: nearly identical to Cal.com, independently arrived at.
- Steal this: convergence is evidence. When two unrelated teams land on the same
  shape for the same class of product, the burden of proof is on deviating.

**Twenty** — open-source CRM.
- Stack: NestJS + GraphQL + TypeORM + Postgres on the backend, React frontend,
  with a user-extensible data model.
- Shape: an opinionated backend framework carrying a dynamic schema.
- Steal this: when users can define their own objects and fields, the structure
  NestJS forces on you stops being boilerplate and starts being the thing that
  keeps a metadata-driven system comprehensible.

**Novu** — notification infrastructure.
- Stack: NestJS monorepo, MongoDB, Redis with Bull for queues, API and worker
  running as separate processes.
- Shape: API accepts and enqueues; workers deliver; the queue is the contract.
- Steal this: splitting the API process from the worker process is the first
  architectural split most products actually need — well before microservices.

**Medusa** — headless commerce platform.
- Stack: Node.js + TypeScript, Postgres, Redis, an internal event bus with
  subscribers, organized into modules.
- Shape: strong module boundaries inside a single deployable.
- Steal this: get the boundaries right in one process first. A modular monolith
  can become services later; a tangled monolith can't.

**Payload CMS** — TypeScript-native headless CMS.
- Stack: TypeScript config-as-code that generates both database schema and admin
  UI; Postgres (via Drizzle) or MongoDB; deep Next.js integration.
- Shape: one typed config file is the source of truth for several layers.
- Steal this: generating from a single typed definition beats maintaining schema,
  types, validation, and forms as four things that drift apart.

---

## Large — many deployables, many teams

**Visual Studio Code** — Microsoft's editor.
- Stack: very large TypeScript monorepo, Electron shell, extension host as a
  separate process, custom build tooling, layered architecture with enforced
  import rules between layers.
- Shape: process isolation as the primary safety mechanism.
- Steal this: two things. Untrusted code runs in its own process, and layer
  boundaries are enforced by tooling rather than by convention — because at
  this size convention always loses.

**n8n** — workflow automation platform.
- Stack: TypeScript monorepo on pnpm, Node backend, Vue frontend, TypeORM with
  Postgres/MySQL/SQLite, and an optional "queue mode" using Redis with separate
  worker processes.
- Shape: runs as a single process by default; scales out by turning on the queue
  and adding workers.
- Steal this: the single-process default with an opt-in distributed mode is
  exactly the right growth path for a job or dispatch engine. Users who don't
  need scale never pay for it, and the path to scale is a config change rather
  than a rewrite.

**Grafana** — observability and dashboarding.
- Stack: Go backend, a very large React + TypeScript frontend, plugin
  architecture with versioned plugin APIs.
- Shape: TypeScript owns the entire frontend and none of the backend.
- Steal this: TypeScript doesn't have to own the whole stack. Picking the right
  language per tier is normal at this size, and the interesting engineering is
  in the contract between them.

**Next.js** — Vercel's React framework.
- Stack: TypeScript for the framework surface, Rust (SWC, Turbopack) for the
  compiler and bundler hot paths.
- Shape: drop out of TypeScript exactly where the work is CPU-bound.
- Steal this: the "rewrite it in Rust" decision, done well, is narrow. One hot
  path, one clear boundary — not a wholesale migration.

**Supabase** — Postgres-based application platform.
- Stack: TypeScript for the dashboard and client libraries; core services in Go,
  Elixir, and Rust; Postgres as the actual center of the system.
- Shape: TypeScript at the edges, purpose-built runtimes in the core.
- Steal this: pushing logic into Postgres — row-level security, functions,
  triggers — rather than reimplementing it in every client is a real
  architectural strategy, not a shortcut.

**Rocket.Chat** — team communication platform.
- Stack: large TypeScript monorepo, MongoDB, service-capable architecture,
  migrated incrementally from a legacy JavaScript codebase.
- Shape: package-by-package strangler migration over years.
- Steal this: large migrations succeed as a sequence of shipped increments with
  the old and new paths coexisting. The big-bang rewrite is the failure mode.

---

# Tool catalog

## 🚀 Frontend

**React** — component UI library.
- Use: meaningful client-side state — dashboards, editors, boards.
- Skip: mostly-static content; Astro or plain HTML ships far less JavaScript.
- Detail: server state is not UI state. Put it in TanStack Query and most of
  your `useEffect` problems disappear along with it.

**Vite** — dev server and build tool.
- Use: default for SPAs and libraries. Instant HMR, near-zero config.
- Skip: you're on Next.js, which owns its own pipeline.
- Detail: Vitest, Nuxt, SvelteKit and Storybook all build on it, so the config
  knowledge transfers across ecosystems.

**Next.js** — React framework with SSR, RSC, routing, edge support.
- Use: public-facing apps where SEO, first paint, or server components matter.
- Skip: anything behind a login. A Vite SPA plus a Fastify API is simpler and
  deploys anywhere.
- Detail: the most common overreach in TypeScript shops is adopting Next for an
  internal admin panel and inheriting the RSC mental model for no benefit.

**Tailwind CSS** — utility-first CSS.
- Use: default. Removes "where is this class defined" permanently.
- Detail: when a pattern repeats, extract a component, not an `@apply` block.
  `@apply` rebuilds the cascade problem Tailwind exists to remove.

**Shadcn** — Radix + Tailwind components copied into your repo.
- Use: you want to own and edit the component source.
- Skip: you'd rather receive upstream fixes automatically — MUI or Mantine.
- Detail: it's a generator, not a dependency. You inherit maintenance of
  everything it writes, including accessibility behavior.

**React Hook Form** — uncontrolled form state.
- Use: any form past three fields. Pair with `@hookform/resolvers/zod`.
- Detail: one Zod schema validating both the form and the API endpoint is the
  point. Two schemas that "match" will not match by the third sprint.

## 🛠️ Backend

**Express** — minimal HTTP framework.
- Use: existing codebases, or middleware that only exists for Express.
- Skip: new performance-sensitive services.
- Detail: still the most widely known Node framework, which is a legitimate
  staffing argument and sometimes the deciding one.

**Fastify** — faster HTTP framework, schema-first.
- Use: default for new services.
- Detail: schema-based serialization is where the speed actually comes from,
  and defining response schemas gets you OpenAPI generation as a side effect.
  Encapsulated plugins mean scoping decorators correctly matters.

**Prisma** — typed ORM with migration tooling.
- Use: default data access; the generated types carry real weight.
- Skip: analytics, recursive CTEs, window functions, or anywhere you need to
  control the query plan.
- Detail: watch for N+1 on nested reads, and know that connection pooling in
  serverless needs a pooler in front. `$queryRaw` is not a failure.

**NestJS** — opinionated DI-driven framework.
- Use: large teams, many modules, structure worth enforcing.
- Skip: a service with six routes — the boilerplate cost lands immediately.
- Detail: pair it with the Fastify adapter rather than the Express default.

**Hono** — tiny web framework built for edge runtimes.
- Use: Cloudflare Workers, Vercel Edge, Bun, Deno.
- Detail: it runs where Fastify can't. That's the entire reason to pick it.

**gRPC** — binary RPC with protobuf contracts.
- Use: internal service-to-service at volume; bidirectional streaming.
- Skip: browser clients — grpc-web needs a proxy that rarely justifies itself.
- Detail: the `.proto` file becomes a versioned artifact with its own review
  process. That discipline is the actual benefit.

**Socket.IO** — realtime with reconnection, rooms, and fallbacks.
- Use: live boards, presence, bidirectional traffic.
- Skip: one-way server→client — Server-Sent Events are simpler and proxy better.
- Detail: past one instance you need the Redis adapter or clients on different
  pods stop seeing each other. Sticky sessions matter if polling fallback is on.
  Rooms are the unit of authorization; get that wrong and you leak data.

## ⚙️ DevOps

**CDKTF** — Terraform written in TypeScript (HashiCorp).
- Use: infra with real logic — loops over environments, shared typed constructs.
- Skip: a handful of resources; HCL reviews better with no synth step.

**kubernetes-models** — typed Kubernetes manifests.
- Use: generating manifests in TS instead of templating YAML.
- Detail: type errors at build time rather than `kubectl apply` errors at deploy.

## 🧰 General Utilities

**Axios** — HTTP client.
- Use: interceptors, upload progress, broad browser support.
- Skip: Node 18+ with straightforward calls — native `fetch` is there.
- Detail: whichever you use, set an explicit timeout. Neither defaults to one,
  and a hung upstream will exhaust your process without it.

**Faker.js** — fake data generation.
- Use: seeds and test fixtures.
- Detail: use `@faker-js/faker`, the community fork created after the original
  was sabotaged by its author in 2022. Keep it in devDependencies — this is the
  classic accidental production dependency. Seed it for reproducible tests.

**Day.js** — small date library, moment-compatible API.
- Use: formatting and relative time.
- Skip: real timezone arithmetic — Luxon, or Temporal once available to you.
- Detail: store UTC, convert at the edges. Every date bug traces back to
  violating that. moment.js is in maintenance mode — don't start new work on it.

**node-cron** — in-process scheduler.
- Use: single-instance jobs and local development.
- Skip: multi-replica deployments — every replica fires the job.
- Detail: for anything that must run exactly once, use a queue job with a lock
  or platform-level cron. This is the single most common production surprise
  on this list.

**lodash-es** — tree-shakeable utilities.
- Use: `groupBy`, `chunk`, `debounce`, deep merge.
- Skip: most of the rest — `Object.groupBy`, `structuredClone` and optional
  chaining are native now.

**filenamify** — safe filenames from arbitrary strings.
- Use: any user-supplied name reaching disk or a storage key.

**url-join** — join URL segments without double slashes.
- Skip: when `new URL(path, base)` does it, which is most of the time.

## 🔒 Encoding, Hashing, Config & Env

**dotenv** — load `.env` files.
- Skip: Node's built-in `--env-file` may already cover your case.
- Detail: whatever loads it, parse `process.env` through a Zod schema at boot
  and crash on failure. Missing config should be a startup error, not an
  `undefined` surfacing three hours into a shift.

**hash-wasm** — fast hashing via WebAssembly.
- Use: large files, or hashing in the browser or a worker.
- Skip: server-side Node — `node:crypto` is fine and adds nothing.
- Detail: neither is for passwords. That's argon2 or bcrypt.

**js-base64** — base64 with unicode handling.
- Skip: Node — `Buffer.from(x).toString('base64')`.

**unconfig** — universal config file loader (Anthony Fu).
- Use: building a tool that accepts config from `.ts`, `.js`, `.json`, or
  `package.json` without caring which.

## 🔐 Security

**Helmet** — security-related HTTP headers.
- Use: every public service, registered first in the chain.
- Detail: headers are a baseline, not a posture. It does nothing for authz,
  rate limiting, or injection. CSP needs actual configuration to be worth having.

## 🖼️ CLI & Terminal Helpers

**yargs** — mature argument parser for multi-command CLIs.

**execa** — child processes with a sane API (Sindre Sorhus).
- Detail: pass arguments as an array, never interpolate user input into a shell
  string. This is command injection's most common entry point in Node.

**ansis** — terminal colors; smaller and faster chalk alternative.
- Detail: respect `NO_COLOR` and detect non-TTY, or your logs fill with escapes.

**clipboardy** — read and write the system clipboard.

**cleye** — TypeScript-first argument parser (by the author of tsx).
- Use: small CLIs wanting typed flags without yargs' surface area.

## 🪵 Logging

**Pino** — structured JSON logging, very fast.
- Use: default for services. JSON is what aggregators actually want.
- Detail: `pino-pretty` in development only — never pipe it in production.
  Configure `redact` for tokens, auth headers, and PII on day one. Bind a
  request ID at the child-logger level so every line is correlatable.
- Rule: `console.log` in a service is a bug.

## 📊 Observability

**OpenTelemetry** — vendor-neutral traces, metrics, and logs.
- Use: anything distributed.
- Detail: instrument boundaries first — HTTP in, DB out, queue publish and
  consume. Propagate trace context into queue message headers or every trace
  dead-ends at the broker, which is exactly where you needed it. Sample in
  production; full-fidelity tracing gets expensive fast.

## 🧠 Dependency Injection / IoC

**Inversify** — IoC container.
- Use: large applications needing swappable implementations, off Nest.
- Skip: small services — hand-wired constructor injection or plain factory
  functions are less magic and far easier to trace in a stack trace.

## 📦 File & Data Utilities

**fs-extra** — `fs` plus `ensureDir`, `copy`, `outputJson`, `remove`.
- Detail: `node:fs/promises` now has `cp`, `rm`, and recursive `mkdir`. Check
  before adding — the gap is much smaller than it was.

**globby** — glob matching with gitignore support (Sindre Sorhus).

**yaml** — full YAML 1.2, preserves comments on round-trip.
- Use: reading *and rewriting* user-authored YAML without destroying comments.
- Skip: read-only parsing — `js-yaml` is lighter.

**@iarna/toml** — TOML parser.
- Detail: verify maintenance status before adopting; `smol-toml` is the more
  actively maintained option.

**gray-matter** — front-matter parsing for markdown content pipelines.

## 🔍 Search & Viewers

*No tools selected.*
- When it becomes relevant: Postgres full-text search first, Meilisearch or
  Typesense when it isn't enough. Elasticsearch is an operational commitment,
  not a library — budget a person for it.

## 🔎 Module & Env Inspectors

**node-modules-inspector** — visualize the dependency graph and ESM/CJS status.
- Use: auditing dependency bloat, or finding the one CJS package blocking a
  full-ESM migration.

## 🧪 Type-Safe Utilities

**Zod** — runtime validation that infers static types.
- Use: **every** trust boundary — request bodies, queue payloads, env vars,
  third-party API responses, webhook bodies.
- Detail: define the schema, then `z.infer` the type. Writing the interface and
  the schema separately guarantees drift. `.strict()` on inbound objects so
  unexpected fields are caught rather than silently carried.

**type-fest** — advanced type helpers (Sindre Sorhus).
- Use: library code and complex generics.
- Skip: application code where a plain interface reads better. Clever types are
  a maintenance cost paid by whoever reads the error message.

**tiny-invariant** — assertion that narrows types, message stripped in prod.
- Use: making "this can't happen" explicit and type-safe at the same time.

## ⚒️ Build & Dev Tools

**tsx** — run TypeScript directly.
- Use: development and one-off scripts.
- Skip: production entrypoints — build first, run the JavaScript.

**nodemon** — restart on change.
- Detail: `tsx --watch` or `node --watch` usually removes the need entirely.

**pnpm** — package manager.
- Use: default, especially in monorepos.
- Detail: the strict `node_modules` layout catches phantom dependencies npm
  silently permits. Commit the lockfile; use `--frozen-lockfile` in CI.

**tsup** — library bundling powered by esbuild.
- Use: publishing a package needing ESM + CJS + declarations without a Rollup
  config. Get the `exports` map right or half your consumers break.

**esbuild** — very fast bundler (by Figma co-founder Evan Wallace).
- Detail: usually consumed through Vite or tsup rather than directly. Note it
  does not type-check — that's a separate `tsc --noEmit` step, and forgetting
  that is how untyped code reaches production.

## ⚙️ CLI & Automation

**cross-env** — cross-platform env vars in npm scripts. It's for Windows.

**zx** — shell scripting with JS ergonomics (Google).
- Use: glue scripts that would be bash but need arrays, JSON, or error handling.

**npm-run-all** — run scripts in series or parallel.
- Detail: check `npm-run-all2`; the original has had maintenance gaps.

**Husky** — git hooks.
- Use: block commits failing lint or typecheck.
- Detail: keep hooks under a couple of seconds or the team learns `--no-verify`
  and the gate is gone. Pair with lint-staged so you check the diff, not the
  repo. Hooks are a fast feedback loop, not a substitute for CI.

**Changesets** — versioning and changelogs for monorepos.
- Use: publishing multiple packages with independent versions.

**release-it** — release automation for a single package.

**taze** — check and upgrade dependencies (Anthony Fu).
- Use: a scheduled sweep. Not an ad-hoc `--latest` the day before a deadline.

## 🧪 Lint, Test & Format

**ESLint** — with `typescript-eslint` for type-aware rules.
- Detail: flat config (`eslint.config.js`) is the current format. Type-aware
  rules are slower and catch the bugs that matter. Turn off every stylistic
  rule and let Prettier own formatting.

**Prettier** — formatting.
- Detail: its value is ending the argument. Configure it minimally and never
  discuss formatting in review again.

**Vitest** — Vite-native test runner.
- Use: default. Jest-compatible API, native ESM and TS, much faster startup.
- Detail: mock at the boundary, not three layers in. Tests that mock internals
  fail on every refactor and catch nothing.

**Supertest** — HTTP assertions against an app instance.
- Use: route-level integration tests without binding a real port.

**Playwright** — browser end-to-end testing (Microsoft).
- Use: critical journeys only — login, checkout, the main board loading.
- Detail: E2E is the slowest and flakiest layer. A dozen reliable tests beat two
  hundred that get muted. Never `waitForTimeout`; wait for a condition.

## 🧩 Monorepo Tooling

**Turborepo** — task orchestration with caching (Vercel).
- Use: more than two packages.
- Detail: caching only works if each task honestly declares inputs and outputs.
  Get that wrong and you ship stale artifacts — worse than no caching at all.

## 📝 Website & Documentation

**TypeDoc** — API documentation from TSDoc comments.
- Use: published libraries.
- Skip: internal services — types and a good README carry more weight than
  generated pages nobody opens.

## 🚀 Deploys

**Azure Container Apps** — managed containers, scale-to-zero, KEDA scaling.
- Use: long-running services, background consumers, WebSocket servers.
- Detail: scale-to-zero and websockets are in tension; set a minimum replica
  count for anything holding connections.

**Azure Functions** — event-driven serverless.
- Use: bursty, short, stateless work.
- Skip: sustained WebSocket connections, cold-start-sensitive paths, and
  anything holding a database connection pool.

**Vercel** — frontend and Next.js hosting.

**Cloudflare Pages** — static and edge hosting; natural pair with Hono.

## 🌱 Consideration to Use

*No tools selected.*
- Worth evaluating when the need appears: **BullMQ** (Redis-backed jobs with
  retries, locks, and repeatable schedules — the answer to node-cron on multiple
  replicas), **Drizzle** or **Kysely** (SQL-shaped alternatives to Prisma),
  **tRPC** (end-to-end types when client and server share a repo),
  **Testcontainers** (real Postgres and Redis in integration tests instead of
  mocks), **TanStack Query** (server state on the client).

---

# Core Technologies Not Listed in the Repository

## Language & Runtime

**TypeScript** — `strict: true` from the first commit. Retrofitting strictness
onto an existing codebase is a project in its own right, and it never gets
prioritized.

**Node.js** — track LTS. Native `fetch`, `--watch`, `--env-file`, and the
built-in test runner have each removed a dependency from lists like this one.
Re-check your utility dependencies at every LTS bump.

## Database

**PostgreSQL** — the default, and rarely the wrong answer. It covers JSON
documents, full-text search, queues at modest volume, and geospatial via
**PostGIS** — which is the deciding factor for anything doing routing or
proximity, because those queries belong in an indexed database rather than a
Node loop.

## Cache

**Redis** — cache, pub/sub, distributed locks, rate limiting, and the Socket.IO
multi-instance adapter.
- Detail: treat it as rebuildable. Anything you can't reconstruct from Postgres
  should not live only here. Set eviction policy and TTLs deliberately — an
  unbounded Redis is a future outage with a date on it.

## Message Queue

**RabbitMQ** — durable work distribution with retries and dead-letter queues.
- Use: work that must not be lost and may need retrying.
- Detail: it's a work queue, not an event log. If you need to replay history
  from the beginning or have several independent consumers read the same stream,
  that's Kafka's job. Consumers must be idempotent — at-least-once delivery
  means duplicates are normal operation, not an error condition.

## API Documentation

**OpenAPI / Swagger** — generate the spec from Fastify's JSON schemas rather
than maintaining it by hand. A hand-written spec is wrong within a month.

## Containers & Infrastructure

**Docker / Docker Compose** — Compose runs Postgres, Redis, and RabbitMQ locally
so integration tests hit real services. Multi-stage builds; don't ship the
toolchain to production.

**Nginx** — reverse proxy and TLS termination. For Socket.IO, remember the
`Upgrade`/`Connection` headers and a read timeout longer than your ping interval.

**GitHub Actions** — typecheck, lint, test, build on every PR. Cache the pnpm
store. Required checks on the protected branch or none of it is enforcement.

**Terraform** — remote backend with state locking, always. Local state is a
single point of failure wearing a disguise.

**Kubernetes** — adopt when the number of services and teams justifies it. Below
that line it's a second system to operate for no return.

**Linux / CI-CD** — assume Linux is the deploy target; keep scripts POSIX-safe
and filenames case-sensitive.

## Version Control

**Git / GitHub** — small PRs, one concern each. Squash on merge so `main` reads
as a list of changes rather than a list of keystrokes.
