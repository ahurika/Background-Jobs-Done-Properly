# AGENTS.md

# Task 2 Engineering Agent Instructions

## 1. Mission

Build **Mailroom Jobs**, the Task 2 background-job system defined in `PRD.md`.

The bootcamp brief is the only assessment source of truth.

The agent is responsible for implementation, verification, documentation, and evidence, but must not expand the product beyond the PRD.

## 2. Mandatory Reading Order

Before any implementation change:

1. Read `AGENTS.md`.
2. Read `PRD.md`.
3. Read the applicable `.agents/rules/*.md` files.
4. Identify affected requirement IDs.
5. State the current phase.
6. Make the smallest change that satisfies the requirement.
7. Run relevant verification.
8. Update documentation/evidence when behavior is complete.

## 3. Source of Truth

Priority order:

1. Task 2 in the bootcamp brief.
2. `PRD.md`.
3. `AGENTS.md`.
4. Applicable rules.
5. Applicable skills.
6. Existing implementation.

If implementation conflicts with the PRD, change implementation rather than silently changing the requirement.

Do not import requirements from Tasks 1, 3, 4, or 5 or from external examples unless required to implement a requirement already present here.

## 4. Locked Product Scope

Product: **Mailroom Jobs**.

Job type: `SEND_EMAIL`.

Required product surface:

- enqueue endpoint;
- separate worker;
- persisted job;
- status endpoint;
- minimal trigger UI;
- minimal status UI;
- dead-letter UI;
- manual retry;
- required failure/recovery behavior;
- required tests and evidence.

Do not build:

- landing pages;
- full dashboards;
- general admin systems;
- full authentication;
- unrelated job types;
- unrelated product features.

## 5. Mandatory Lifecycle

Statuses:

- `pending`
- `processing`
- `succeeded`
- `failed`
- `dead`

Never remove `dead`.

Never collapse `failed` and `dead`.

## 6. Non-Negotiable Engineering Rules

### Enqueue
Validate, persist pending job, return `202`, and exit. Never perform email work in the request handler.

### Idempotency
The enqueue idempotency key must have a database uniqueness constraint. Do not rely only on a pre-check.

### Claiming
Never claim with separate SELECT then UPDATE operations. Claim must atomically transition `pending` to `processing`.

### Concurrency
Never exceed configured worker concurrency.

### Retry
Increment attempts, record the error, use exponential backoff with jitter, and stop at `maxAttempts`.

### Recovery
Use a configurable processing timeout and recover stuck jobs.

### Work idempotency
A worker crash after external work succeeds must not cause an unintended duplicate email.

## 7. Configuration

Operational parameters must be centralized:

- `DATABASE_URL`
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM`
- `WORKER_CONCURRENCY`
- `JOB_MAX_ATTEMPTS`
- `JOB_BACKOFF_BASE_MS`
- `JOB_BACKOFF_JITTER_MS`
- `JOB_PROCESSING_TIMEOUT_MS`

Never commit secrets.

## 8. Requirement Traceability

Every meaningful implementation change must name the affected PRD requirement IDs.

Core ranges:

- Job schema: `R6-R16`
- Enqueue: `R17-R20`
- Worker/claim: `R21-R25`
- Failure/retry: `R26-R32`
- Idempotent work: `R33`
- Recovery: `R34-R35`
- Dead letter: `R36-R38`
- Status: `R39-R40`
- Break-it tests: `R41-R45`
- Evidence: `R46-R50`
- Defence: `R52-R55`
- Post: `R56`
- Explainability: `R57`

## 9. Checkpoint Discipline

Use these phases:

- `P0` Read and plan
- `P1` Database
- `P2` Enqueue
- `P3` Worker
- `P4` Failure/retry
- `P5` Recovery
- `P6` UI
- `P7` Break-it tests
- `P8` Evidence
- `P9` Documentation/defence

At every checkpoint report:

- phase;
- requirements;
- files changed;
- verification;
- unresolved issue.

Do not silently skip phases.

## 10. Testing Discipline

Do not mark a requirement complete without relevant verification.

Required break-it tests:

1. 50 jobs and concurrency cap.
2. 100% failure through `dead`.
3. Worker kill and recovery.
4. Duplicate idempotency key.
5. Two workers without collision.

Do not fabricate evidence.

## 11. Documentation Discipline

When behavior changes, update the README and relevant evidence/defence notes.

Never document behavior the implementation does not actually perform.

## 12. Definition of Done

Task 2 is complete only when every PRD Definition of Done item is verified and the implementation can be explained line by line.
