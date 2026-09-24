# Skill: Job Record
Activation: Glob `**/prisma/**`

Model:
id, type, payload, status, attempts, maxAttempts, lastError, runAt, startedAt, finishedAt, idempotencyKey, userId, createdAt, updatedAt.

The idempotency key must have a database uniqueness constraint.

Add only indexes necessary for job lookup, polling, claiming, and recovery.
