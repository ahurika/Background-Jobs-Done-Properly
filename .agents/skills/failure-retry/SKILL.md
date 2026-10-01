# Skill: Failure and Retry
Activation: Glob `**/worker/**`, `**/lib/jobs/**`

On failure:
1. increment attempts;
2. store lastError;
3. if attempts remain, calculate exponential backoff plus jitter and return to pending;
4. otherwise transition to dead.

Parameters come from centralized configuration. Timestamps must allow the backoff evidence to be inspected.
