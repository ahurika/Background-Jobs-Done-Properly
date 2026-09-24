# Skill: Idempotency
Activation: Glob `**/lib/email/**`, `**/worker/**`, `**/app/api/**`

Handle:
1. enqueue idempotency through a database unique constraint;
2. work idempotency so repeated execution of one Job does not unintentionally send duplicate email.

Explicitly account for the crash-after-external-work-before-success-record scenario.
