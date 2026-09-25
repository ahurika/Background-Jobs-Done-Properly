# Mailroom Jobs: Background Jobs Done Properly

Mailroom Jobs is a robust background job system built to demonstrate how to safely detach slow or unreliable work (like sending emails) from the synchronous HTTP request path. The system leverages Next.js (App Router), Prisma, and SQLite to provide an end-to-end job queuing mechanism.

## Getting Started

### Installation
1. Clone the repository and run `npm install`.
2. Generate the Prisma client and database: `npx prisma migrate dev --name init`.

### Environment Variables
Copy `.env.example` to `.env` and configure:
```env
DATABASE_URL="file:./dev.db" # Database connection string
EMAIL_PROVIDER_API_KEY="dummy-key-for-dev"
EMAIL_FROM="system@mailroom.local"
WORKER_CONCURRENCY=5 # Max concurrent jobs processed per worker
JOB_MAX_ATTEMPTS=5 # Maximum retry attempts before going dead
JOB_BACKOFF_BASE_MS=1000 # Base exponential backoff delay (ms)
JOB_BACKOFF_JITTER_MS=500 # Random jitter max applied to delay (ms)
JOB_PROCESSING_TIMEOUT_MS=60000 # Time before a processing job is considered stuck
```

### Running the Application
To run the Next.js UI and API trigger endpoints:
`npm run dev`

### Running the Worker
To start a standalone worker process:
`npx tsx worker/index.ts`
*(Note: The recovery process runs periodically on the same tick loop within this script).*

## System Capabilities

### 1. Enqueue & Status API
- **Enqueue**: Submitting a job to `POST /api/jobs` persists a `pending` job to the database and immediately returns `202 Accepted` alongside the tracking `job.id`. The request explicitly does NOT wait for the external email provider.
- **Status**: The progress of a job can be polled via `GET /api/jobs/:id`.

### 2. Job Lifecycle
The job iterates through explicit, non-destructive states:
`pending` -> `processing` -> `succeeded`
*Or on failure:*
`processing` -> `failed` -> (retry delay) -> `pending` ... -> `dead`

### 3. Idempotency Guarantee
The database enforces uniqueness on the `idempotencyKey`. If a duplicate request is dispatched, the database natively prevents duplicate insertion (`P2002` error caught), and the API cleanly returns the existing job ID without spawning duplicate workloads.

### 4. Atomic Claiming
Workers do not run unsafe `SELECT` -> `UPDATE` workflows. They query and lock the row natively using Prisma's `$queryRaw` executing an `UPDATE ... RETURNING` statement. This makes it structurally impossible for two workers to claim the exact same pending job, effectively eliminating race conditions.

### 5. Configurable Concurrency
Workers rigidly respect `WORKER_CONCURRENCY`. Active jobs are incremented atomically inside the Node loop; the worker artificially delays polling if capacity is saturated, preventing resource starvation.

### 6. Retry, Exponential Backoff & Jitter
Failing jobs calculate their next `runAt` dynamically. The backoff formula multiplies `JOB_BACKOFF_BASE_MS` exponentially by the attempt count, then adds up to `JOB_BACKOFF_JITTER_MS` to prevent synchronized retry spikes (thundering herds). 

### 7. Stuck-Job Recovery
If a worker physically crashes while `processing`, the job normally stays locked forever. A background recovery sweep periodically scans for jobs older than `JOB_PROCESSING_TIMEOUT_MS` and safely transitions them back to `pending` with an incremented attempt count.

### 8. Dead-Letter & Manual Retry
Jobs exceeding `JOB_MAX_ATTEMPTS` are explicitly set to `dead`. The UI provides a specialized view `/dead` where operators can inspect failure traces (payload, timestamp, error) and invoke `POST /api/jobs/:id/retry`. The retry explicitly maintains the job's ID history but resets attempts and sets the state back to `pending`.

## Defence Notes

### Q1: Two workers are running. Walk me through exactly how you guarantee they never process the same job.
**Answer:** The claim query does not do a separate SELECT then UPDATE. I implemented an `UPDATE Job SET status = 'processing' ... WHERE id = (SELECT id FROM Job WHERE status = 'pending' ... LIMIT 1) RETURNING *` via `$queryRaw`. Because the database applies the lock on the row natively during the update phase, the second worker attempting to claim that same job simultaneously will find 0 matching rows to update. It guarantees strict atomicity.

### Q2: Your worker crashed after sending the email but before marking the job done. What happens when it restarts?
**Answer:** Because the system recovered the stuck job and retried it, the external work is triggered again. However, our provider function natively passes down the `idempotencyKey` (mapped from the database `job.id`). The external email provider inherently recognizes this key and drops the duplicate transmission, yielding a harmless 200 OK back to the worker without duplicating the email. 

### Q3: Why jitter? Show me the line.
**Answer:** `const delay = (BASE_MS * Math.pow(2, newAttempts - 1)) + Math.floor(Math.random() * JITTER_MS);`
If an external API goes down globally, all 1,000 pending jobs would fail simultaneously and be scheduled to retry at the *exact* same millisecond (`BASE_MS * 2`). Adding random jitter spreads these retries out across a `JITTER_MS` window, drastically reducing load spikes when the API comes back online.

### Q4: A job has been in processing for an hour. What does your system do about it and when?
**Answer:** Our `worker/recovery.ts` script checks for processing jobs where `startedAt < (Date.now() - JOB_PROCESSING_TIMEOUT_MS)`. Since the timeout is configured to 60,000ms by default, a job stuck for an hour is swept up by the next 10-second interval check. It resets it to `pending`, increments the attempt count (to prevent infinite loops of fatal jobs), and logs the recovery.

## Break-It Tests & Evidence
Five rigorous stress tests were scripted in `tests/run-tests.ts` and `tests/run-test3-5.ts`, validating limits and recoveries:
1. **Concurrency Cap**: 50 simultaneous jobs were injected. The worker logs perfectly reflect a steady cap of 5 active threads (`activeJobs`).
2. **100% Failure**: A poisoned job (`fail@example.com`) was submitted. Evidence shows it progressing exactly through 3 configured attempts, exponentially backing off, and finally dying at `dead`.
3. **Worker Kill**: A worker was killed via Node `.kill()` 150ms into a job. The DB state stalled at `processing`, until `recoverStuckJobs` swept it up, reset it to `pending`, and a secondary worker completed it.
4. **Duplicate Idempotency**: Submitting the same key twice sequentially blocked the second insert, maintaining absolute uniqueness constraint (`P2002`).
5. **Two Workers**: `[W1]` and `[W2]` ran concurrently processing 20 jobs. Zero collisions occurred due to the `UPDATE ... RETURNING` atomic lock.

*(Logs mapping these behaviors are safely archived in the `evidence/` directory)*.

### Additional Evidence
- **Jobs Table Statuses**: A screenshot demonstrating all 5 required job states (`pending`, `processing`, `succeeded`, `failed`, `dead`) in the database is available at [`evidence/jobs-table-statuses.png`](evidence/jobs-table-statuses.png).
- **Test Execution Output**: A screenshot of the terminal running the automated break-it tests is available at [`evidence/tests-run-output.png`](evidence/tests-run-output.png).
- **Worker Backoff & Recovery**: A screenshot demonstrating the worker's exponential backoff, jitter (`2333ms`, `4002ms`, `8479ms`), stuck job recovery, and transition to `DEAD` is available at [`evidence/worker-retry-backoff-recovery.png`](evidence/worker-retry-backoff-recovery.png).

---
**Prepared For:** Task 2, Product Engineering Bootcamp.
