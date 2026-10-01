# PRD.md

# Task 2: Background Jobs Done Properly

**Project:** Background Jobs Done Properly  
**Product:** Mailroom Jobs  
**Assessment:** Product Engineering Bootcamp, Task 2  
**Source of truth:** The Five Engineering Tasks bootcamp brief  
**Implementation language:** TypeScript  
**Status:** Ready for implementation

---

## 1. Source of Truth

This PRD is derived only from the Task 2 section of the bootcamp brief.

Task 2 requires a job system that:

- takes slow or unreliable work off the request path;
- runs the work in the background;
- survives failure;
- records what happened to every job;
- has a minimal trigger and status interface;
- enforces idempotency;
- atomically claims jobs;
- caps worker concurrency;
- retries failures using exponential backoff with jitter;
- recovers stuck jobs;
- exposes a dead-letter view with manual retry;
- exposes a job status endpoint;
- is deliberately broken through the five tests specified in the brief;
- records evidence for those tests.

**Do not add product requirements merely because they are common in production systems. If a behavior is not required by this PRD or the source brief, do not build it unless it is necessary to satisfy an identified requirement.**

---

# 2. Product Definition

## 2.1 Product name

**Mailroom Jobs**

## 2.2 What it does

Mailroom Jobs demonstrates a background job system for sending emails through a real external email provider.

A user submits an email job. The API immediately creates a pending job and returns `202 Accepted` with the job ID. A separate worker later claims the job, sends the email through the configured provider, and records success or failure.

The system intentionally treats the external email provider as a slow/unreliable dependency so that the queue lifecycle can be demonstrated under real failure conditions.

## 2.3 Why email delivery

The source brief explicitly lists sending an email through a real provider as an appropriate example of genuinely slow or unreliable work.

Email also makes the required lifecycle easy to demonstrate:

`pending → processing → succeeded`

or:

`pending → processing → failed → pending → processing ... → dead`

The work is external, can fail, and can be made safely idempotent by using the job identity as the logical delivery key.

## 2.4 What is not being built

Per the brief:

- No landing page.
- No full dashboard.
- No general admin application.
- No authentication beyond identifying a user.
- No unrelated product features.
- No synchronous email sending inside the request handler.

The interface consists only of:
1. a minimal trigger for creating a job;
2. a status view for an individual job;
3. a minimal dead-letter view with manual retry.

---

# 3. Goals

1. Prove that slow/unreliable work is removed from the HTTP request path.
2. Prove that every job has a complete observable lifecycle.
3. Prove that retries are bounded.
4. Prove that retries use exponential backoff with jitter.
5. Prove that duplicate logical jobs are prevented by a database-enforced idempotency key.
6. Prove that two workers cannot claim the same job.
7. Prove that concurrency is capped by configuration.
8. Prove that stuck processing jobs can recover.
9. Prove that exhausted jobs become `dead`.
10. Prove that a human can inspect and manually retry a dead job.
11. Produce the evidence required by the assessment.

---

# 4. Non-Goals

- Building a complete email product.
- Building a full email inbox.
- User authentication and account management.
- Email campaign management.
- Templates marketplace.
- Analytics.
- Scheduling UI beyond the job's configured retry time.
- Multiple queue technologies.
- Multiple worker implementations.
- A production-scale distributed platform.
- Features not required to demonstrate the Task 2 lifecycle.

---

# 5. Users

## 5.1 Identified user

A minimal user/client that submits an email job and needs to know what happened to it.

The assessment requires no authentication beyond identifying a user. The implementation may identify the submitting user using a simple `userId` supplied to the trigger request. It must not expand this into a full authentication system.

## 5.2 Human operator

A person responsible for inspecting dead jobs and manually retrying them.

No separate authentication system is required by the brief.

---

# 6. Core User Flows

## Flow A: Enqueue

1. Client submits an email job.
2. Request includes an idempotency key.
3. Server validates the request.
4. Server creates one `Job` row with `status = pending`.
5. Server returns `202 Accepted`.
6. Response includes the job ID and current status.
7. The request does not send the email.
8. The request does not wait for the worker.

## Flow B: Successful processing

1. Worker finds an eligible pending job.
2. Worker atomically changes it from `pending` to `processing`.
3. Worker records `startedAt`.
4. Worker performs the email provider call.
5. If successful, worker changes status to `succeeded`.
6. Worker records `finishedAt`.
7. The job remains queryable through the status endpoint.

## Flow C: Retryable failure

1. Worker claims a pending job.
2. External email work fails.
3. Worker increments `attempts`.
4. Worker stores the error in `lastError`.
5. If `attempts < maxAttempts`, worker:
   - sets status to `pending`;
   - calculates exponential backoff with jitter;
   - sets `runAt` to the next attempt time.
6. A later worker loop can claim it again.

## Flow D: Dead job

1. Work fails.
2. Worker increments `attempts`.
3. `attempts` reaches `maxAttempts`.
4. Worker stores `lastError`.
5. Worker changes status to `dead`.
6. The dead-letter view displays the job and enough context to diagnose it.
7. Human selects manual retry.
8. The job is returned to `pending` according to the retry contract defined in implementation.

## Flow E: Stuck job recovery

1. Worker claims a job and changes it to `processing`.
2. Worker dies before finishing.
3. Job remains `processing`.
4. Recovery sweep finds processing jobs older than configured timeout.
5. Sweep resets the job to `pending`.
6. Attempt count is incremented as required by the brief.
7. Job becomes eligible for another worker attempt.

## Flow F: Duplicate enqueue

1. Client sends an idempotency key.
2. Job is created.
3. Client sends the same logical request with the same idempotency key again.
4. Database uniqueness prevents a second logical job.
5. API returns the existing job rather than creating another job.

---

# 7. Job Record

Every job is represented by one database row.

| Field | Type | Required | Purpose |
|---|---|---:|---|
| `id` | generated identifier | Yes | Job identity |
| `type` | string/enum | Yes | Kind of work |
| `payload` | JSON | Yes | Input for the job |
| `status` | enum | Yes | Current lifecycle state |
| `attempts` | integer | Yes | Number of attempts already made |
| `maxAttempts` | integer | Yes | Maximum attempts from configuration |
| `lastError` | string nullable | No | Most recent failure |
| `runAt` | datetime | Yes | Earliest time job can be attempted |
| `startedAt` | datetime nullable | No | When current processing attempt began |
| `finishedAt` | datetime nullable | No | When job reached a terminal state |
| `idempotencyKey` | string | Yes | Unique logical job key |
| `userId` | generated/user identifier | Yes | Identifies submitting user |
| `createdAt` | datetime | Yes | Creation timestamp |
| `updatedAt` | datetime | Yes | Last update timestamp |

## Allowed status values

Exactly these lifecycle states are required:

- `pending`
- `processing`
- `succeeded`
- `failed`
- `dead`

`failed` means the latest attempt failed but the job has remaining retries.

`dead` means the job has exhausted its configured retries and requires human intervention.

---

# 8. Job Type

The first and only job type for this assessment is:

`SEND_EMAIL`

Payload:

```json
{
  "to": "recipient@example.com",
  "subject": "Background job test",
  "body": "This email was processed by a background worker."
}
```

The exact validation constraints are centralized in the request schema.

Do not introduce additional job types unless required for the assessment.

---

# 9. Idempotency

Every enqueue request must contain an `idempotencyKey`.

The database must enforce uniqueness.

The same logical key must never result in two Job rows.

When a request arrives with an existing idempotency key:

- do not create another job;
- return the existing job;
- do not enqueue duplicate work.

This is a database-level guarantee, not only an application pre-check.

---

# 10. Enqueue API

## Endpoint

`POST /api/jobs`

The request identifies the user and contains:

- `userId`
- `type`
- `payload`
- `idempotencyKey`

Example:

```json
{
  "userId": "user-demo-001",
  "type": "SEND_EMAIL",
  "payload": {
    "to": "recipient@example.com",
    "subject": "Background job test",
    "body": "This email was processed by a background worker."
  },
  "idempotencyKey": "email-demo-001"
}
```

## Success

Return:

`202 Accepted`

The response must contain the job ID and current status, giving the client what it needs to poll.

The request must return without waiting for the email provider.

---

# 11. Status API

## Endpoint

`GET /api/jobs/:id`

Return the current job state, including at minimum:

- job ID;
- type;
- status;
- attempts;
- maxAttempts;
- lastError when applicable;
- runAt;
- startedAt when applicable;
- finishedAt when applicable.

The client uses this endpoint to poll for the outcome.

---

# 12. Dead Letter View

The application must provide a minimal dead-letter view.

It must:

1. list jobs with `status = dead`;
2. show their payload;
3. show the last error;
4. show attempts;
5. provide a manual retry action.

Keep the interface diagnostic and minimal. Do not turn it into a full operations dashboard.

---

# 13. Worker

The worker is a separate process from the request handler.

It repeatedly:

1. finds an eligible pending job whose `runAt` is in the past;
2. atomically claims one job;
3. changes status from `pending` to `processing`;
4. performs the work;
5. records success or failure;
6. continues according to the configured concurrency limit.

## Atomic claim

Claiming MUST happen atomically.

Do not implement claim as:

1. read pending job;
2. later update that job.

That allows two workers to observe the same job.

The database operation must guarantee that only one worker wins.

---

# 14. Concurrency

Worker concurrency is configurable.

Required setting:

`WORKER_CONCURRENCY`

The worker must never process more than the configured number of jobs at once.

Concurrency must be observable through logs or equivalent evidence.

---

# 15. Failure Handling

When the external email operation fails:

1. increment `attempts`;
2. store the failure message in `lastError`;
3. determine whether retries remain.

If `attempts < maxAttempts`:

- status becomes `pending`;
- `runAt` moves into the future;
- delay uses exponential backoff with jitter.

If `attempts >= maxAttempts`:

- status becomes `dead`;
- `finishedAt` is recorded;
- `lastError` remains available.

---

# 16. Exponential Backoff With Jitter

Retry delay must follow an exponential pattern with random jitter.

Conceptual formula:

```text
delay = baseDelay * 2^attempts + randomJitter
```

Required configuration:

```text
JOB_MAX_ATTEMPTS
JOB_BACKOFF_BASE_MS
JOB_BACKOFF_JITTER_MS
```

Do not use one fixed retry delay.

Do not retry forever.

---

# 17. Idempotent Work

The email operation must tolerate a worker crash occurring after external work succeeds but before the database marks the job succeeded.

The implementation must use the job identity as part of the logical delivery identity or an equivalent mechanism supported by the chosen email provider.

Before producing the output, the worker must be able to determine whether the job's output has already been produced.

The required outcome is that a second execution of the same job does not unintentionally send the same email twice.

---

# 18. Stuck Job Recovery

Required configuration:

`JOB_PROCESSING_TIMEOUT_MS`

A recovery sweep must find jobs that:

- are `processing`;
- have exceeded the configured processing timeout.

The sweep must:

1. reset the job to `pending`;
2. increment the attempt count;
3. make it eligible for another attempt.

The timeout must not be hard-coded in worker logic.

---

# 19. Configuration

At minimum:

```text
DATABASE_URL
EMAIL_PROVIDER_API_KEY
EMAIL_FROM
WORKER_CONCURRENCY
JOB_MAX_ATTEMPTS
JOB_BACKOFF_BASE_MS
JOB_BACKOFF_JITTER_MS
JOB_PROCESSING_TIMEOUT_MS
```

The project must provide `.env.example` placeholders without real secrets.

---

# 20. Minimal UI

The UI exists only to prove the system works.

## Trigger

A minimal form can submit:

- recipient;
- subject;
- body;
- idempotency key.

After submission, display the returned job ID and status.

## Status

Allow the user to view/poll a job by ID.

Show:

- current status;
- attempts;
- error;
- timestamps.

## Dead letter

Show dead jobs with:

- payload;
- last error;
- attempts;
- retry button.

No additional dashboard functionality is required.

---

# 21. Required Break-It Tests

## Test 1: 50 jobs

Enqueue 50 jobs at once.

Verify:

- all jobs enter the system;
- concurrency never exceeds configured `WORKER_CONCURRENCY`;
- logs show the cap holding.

## Test 2: 100% failure

Make the email work fail 100% of the time.

Verify a job moves through attempts until `dead`.

Evidence must show attempts, backoff, timestamps, and final dead status.

## Test 3: Kill worker mid-job

1. Start a job.
2. Kill the worker while the job is processing.
3. Confirm the job remains processing temporarily.
4. Restart/recover the worker.
5. Confirm the stuck-job sweep resets it.
6. Confirm it can be processed again.

Evidence must include before kill, after kill, and after recovery.

## Test 4: Duplicate idempotency key

Submit the same idempotency key twice.

Verify:

- exactly one logical Job row exists;
- second submission returns the existing job;
- duplicate work is not created.

## Test 5: Two workers

Run two workers concurrently against the same database.

Verify:

- both workers can process jobs;
- no single job is claimed twice;
- atomic claim prevents collision.

---

# 22. Evidence Requirements

The repository must contain evidence for:

1. Jobs table showing:
   - pending
   - processing
   - succeeded
   - failed
   - dead
2. Timestamps demonstrating increasing retry backoff.
3. Worker logs demonstrating the concurrency cap under 50 jobs.
4. Stuck-job recovery:
   - before worker kill;
   - after worker kill;
   - after recovery.
5. Dead-letter view containing at least one dead job.
6. Idempotency evidence.
7. Two-worker collision-prevention evidence.

Do not fabricate evidence.

---

# 23. Requirement Traceability

| ID | Requirement |
|---|---|
| R1 | Build a background job system |
| R2 | Use genuinely slow or unreliable work |
| R3 | Provide only a minimal trigger/status interface |
| R4 | No landing page |
| R5 | No full interface/admin panel |
| R6 | Every job is a database row |
| R7 | Job uses a generated identifier |
| R8 | Job type is stored |
| R9 | Input payload is stored as JSON |
| R10 | Job has the required lifecycle statuses |
| R11 | Attempts are stored |
| R12 | maxAttempts comes from configuration |
| R13 | Last error is stored |
| R14 | runAt is stored |
| R15 | startedAt and finishedAt are stored |
| R16 | idempotencyKey is unique |
| R17 | Enqueue creates a pending job |
| R18 | Enqueue returns 202 immediately |
| R19 | Enqueue does not perform the work |
| R20 | Duplicate idempotency key returns existing job |
| R21 | Worker is a separate process |
| R22 | Worker claims eligible jobs |
| R23 | Claim is atomic |
| R24 | Two workers cannot claim one job |
| R25 | Concurrency is capped |
| R26 | Failure increments attempts |
| R27 | Failure stores lastError |
| R28 | Retry occurs below maxAttempts |
| R29 | Job becomes dead at maxAttempts |
| R30 | Backoff is exponential |
| R31 | Backoff includes jitter |
| R32 | Backoff parameters are configurable |
| R33 | Work is idempotent |
| R34 | Stuck processing jobs recover |
| R35 | Stuck-job timeout is configurable |
| R36 | Dead-letter view exists |
| R37 | Dead jobs show payload/error context |
| R38 | Dead jobs can be manually retried |
| R39 | Status endpoint exists |
| R40 | Status exposes attempts/error |
| R41 | 50-job concurrency test |
| R42 | 100% failure test |
| R43 | Worker-kill recovery test |
| R44 | Duplicate-key test |
| R45 | Two-worker test |
| R46 | Jobs-table evidence |
| R47 | Backoff timestamp evidence |
| R48 | Concurrency log evidence |
| R49 | Stuck-job evidence |
| R50 | Dead-letter evidence |
| R51 | Failed and dead are distinct |
| R52 | Atomic claim defence answer |
| R53 | Crash-after-work defence answer |
| R54 | Jitter defence answer |
| R55 | Stuck-job defence answer |
| R56 | Public post about failed/dead or worker kill |
| R57 | Submitted work remains explainable line by line |

---

# 24. Configuration Defaults

These are implementation defaults and must remain configurable.

| Setting | Default |
|---|---:|
| `WORKER_CONCURRENCY` | `5` |
| `JOB_MAX_ATTEMPTS` | `5` |
| `JOB_BACKOFF_BASE_MS` | `1000` |
| `JOB_BACKOFF_JITTER_MS` | `500` |
| `JOB_PROCESSING_TIMEOUT_MS` | `60000` |

---

# 25. Repository Shape

```text
task-2-background-jobs/
├── PRD.md
├── AGENTS.md
├── README.md
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── app/
│   ├── api/
│   │   └── jobs/
│   ├── jobs/
│   └── ...
├── components/
├── lib/
│   ├── config/
│   ├── jobs/
│   ├── email/
│   └── db/
├── worker/
│   ├── index.ts
│   ├── processor.ts
│   ├── claim.ts
│   └── recovery.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── tests/
├── evidence/
└── .agents/
    ├── rules/
    └── skills/
```

The exact implementation may reorganize files when necessary, but every change must preserve requirement traceability.

---

# 26. Implementation Phases

## P0: Read and plan
Read `AGENTS.md`, `PRD.md`, and applicable rules. Confirm requirements before coding.

## P1: Database
Create the Job model, lifecycle enum, unique idempotency constraint, timestamps, and necessary indexes.

## P2: Enqueue
Build validation, `POST /api/jobs`, pending persistence, and `202` response.

## P3: Worker
Build the separate worker, atomic claim, concurrency cap, and email work.

## P4: Failure and retry
Implement attempts, error storage, exponential backoff, jitter, and dead state.

## P5: Recovery
Implement processing timeout and recovery sweep.

## P6: UI
Build the minimal trigger, status view, dead-letter view, and manual retry.

## P7: Break-it tests
Run all five required attacks.

## P8: Evidence
Capture every required artifact while behavior is reproducible.

## P9: Documentation and defence
Complete README, defence notes, and public-post material.

---

# 27. Definition of Done

- [ ] Slow/unreliable work runs outside the request handler.
- [ ] Enqueue returns `202`.
- [ ] Job contains the complete required lifecycle fields.
- [ ] Idempotency is enforced by a database uniqueness constraint.
- [ ] Worker claim is atomic.
- [ ] Concurrency is configurable and capped.
- [ ] Retries use exponential backoff and jitter.
- [ ] Failed and dead are distinct.
- [ ] Work is idempotent.
- [ ] Stuck jobs recover.
- [ ] Dead jobs appear in a dead-letter view.
- [ ] Dead jobs can be manually retried.
- [ ] Status endpoint works.
- [ ] All five break-it tests are completed.
- [ ] All required evidence is captured.
- [ ] README explains the system.
- [ ] Defence questions have been answered.
- [ ] Public post is prepared.
- [ ] Every file can be explained line by line.

---

# 28. Defence Preparation

### Atomic claim
Explain the exact database operation that atomically transitions `pending` to `processing` and why two workers cannot both win.

### Crash after external work
Explain what happens if the worker sends the email and crashes before recording success, and how the work-idempotency mechanism prevents an unintended duplicate.

### Jitter
Explain the retry calculation and why random jitter prevents synchronized retries.

### Stuck processing
Explain the configured processing timeout and recovery sweep.

---

# 29. Public Post

The post must focus on either:

- the difference between `failed` and `dead`; or
- what happened when the worker was killed mid-job.

Include the screenshot of the jobs table with every status visible.

The post should teach one concrete engineering lesson rather than merely announce completion.

---

# 30. AI Engineering Guardrails

AI agents may be used, but submitted work must remain explainable line by line.

Agents must:

1. read `AGENTS.md` first;
2. read `PRD.md` before implementation;
3. identify active requirement IDs before changing code;
4. not invent product scope;
5. preserve the job lifecycle;
6. never replace atomic claiming with read-then-write logic;
7. never remove `dead`;
8. never retry forever;
9. never move email work into the request handler;
10. never hide operational parameters as hard-coded values;
11. update documentation when behavior changes;
12. record test evidence before declaring a requirement complete.

---

# 31. Source Boundary

The bootcamp brief is the authority for assessment requirements.

Where this PRD makes an implementation choice, that choice is a project decision rather than a new bootcamp requirement.

The brief does not prescribe a particular framework, ORM, database, email vendor, or deployment provider. Those are implementation decisions and must not be presented as bootcamp requirements.
