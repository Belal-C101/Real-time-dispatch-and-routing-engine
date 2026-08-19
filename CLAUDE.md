Please strictly follow these rules:

# Project

- Name: Dispatch and Routing Engine
- Purpose: Assigns and sequences same-day pickup and delivery stops for P&D drivers so terminal dispatchers can commit to a plan in the morning and re-cut it as the day moves.
- Consumers: Dispatchers in a browser (primary), drivers on mobile devices, and CLI as an upstream service for shipment and stop data.
- Scale reality: 2,000 stops/day across 5 terminals, 100 active tractors, 12 dispatchers concurrent at the 6:00–8:00am peak, 1.5M shipment records retained.
- Hard constraints:
  - Every assignment and resequence is auditable — actor, timestamp, prior state, reason code. Driver pay and customer disputes both trace back here.
  - A full terminal replan returns in under 5 seconds, so a dispatcher can use it while still on the phone with a customer.
  - The engine never emits a plan that violates HOS. A dispatcher may override; the engine may not.
  - CLI remains system of record for shipments and billing. This engine reads from it and never writes rated or billing fields.
  - Coast runs lose signal. Driver devices tolerate 180 minutes offline without losing stop completions; the queue reconciles on reconnect.
  - Manual overrides persist. The engine may recommend against one, never silently revert it.
- Out of scope: rating and invoicing, interline tendering, customer-facing ETA portal, driver payroll calculation, linehaul and network design.
- Source of truth for behavior: SPEC.md in the repo, with routing algorithm choices recorded as ADRs in /docs. If code and SPEC.md disagree, SPEC.md wins — flag the gap, don't edit the spec to match the code.

# Stack

- Profile: P4 — Realtime engine (dispatch, tracking, live boards)
- Anything not in the profile needs a one-line reason in the PR description.
- Do not introduce a dependency for something the runtime or an existing
  dependency already does. Check before adding.

# Commands

- Test: pnpm test
- Typecheck: pnpm typecheck
- Lint: pnpm lint
- Build: pnpm build
- Run locally: pnpm dev
- Migrate: pnpm --filter @dispatch/api prisma migrate dev
- Seed: pnpm --filter @dispatch/api prisma db seed
- E2E: pnpm --filter @dispatch/api test:e2e
- Codegen: pnpm --filter @dispatch/api prisma generate

# Workflow

- Change touching >1 file or altering behavior → plan first (plan mode).
  If you can describe the diff in one sentence, just do it.
- Ambiguous requirements → interview me with AskUserQuestion. Don't guess.
- Stop at the end of each Phase. Summarize, wait for approval.
- Single branch, commit per Phase, one PR at the end.
- Read the surrounding code before writing. Match what's there; if what's
  there is wrong, say so rather than quietly doing it differently.
- Schema or contract change → the migration or version bump lands in the same
  commit as the code that needs it. Never edit an already-applied migration.

# Definition of done

- YOU MUST run typecheck + tests before claiming done.
- Paste the raw output. "I verified it" without output is not done.
- Name what you checked for regressions.
- New input boundary → validated at the boundary, plus one test for the
  reject path. Not just the happy path.
- New async or I/O path → state what happens on timeout, retry, and duplicate
  delivery. "It won't happen" is not an answer.
- Behavior change → the docs, types, or spec that describe it are updated in
  the same PR, or you tell me explicitly that they aren't.

# Sub-agents

- Read-only exploration and search: use aggressively.
- Never parallelize edits in the same working tree.
- After implementing: subagent reviews the diff against <spec source>.
  Report correctness gaps only, not style.

# Disagreement

- Push back with specific reasoning and evidence when I'm wrong.
- If you agree, one line and move on. No manufactured objections.
- Uncertain → say so plainly and name what would resolve it. Don't hedge
  your way through an answer you don't have.

# Output

- Lead with the answer. No preamble, no restating my request back to me.
- Show the diff or the command output, not a description of it.
- Match the length of the task. A one-line fix gets a one-line explanation.

# Gotchas

- (log real repeated mistakes here only)
