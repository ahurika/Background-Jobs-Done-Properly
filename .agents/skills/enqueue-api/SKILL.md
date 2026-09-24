# Skill: Enqueue API
Activation: Glob `**/app/api/**`

Implement:
1. validate;
2. enforce idempotency;
3. create or retrieve the Job;
4. return 202;
5. never perform email work.

The request must not wait for the worker.
