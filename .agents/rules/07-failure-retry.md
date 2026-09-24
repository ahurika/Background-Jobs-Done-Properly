# Rule 07: Failure and Retry
Activation: Glob `**/worker/**`, `**/lib/jobs/**`

On failure:
- increment attempts;
- store lastError;
- retry only while attempts remain;
- use exponential backoff;
- add jitter;
- transition to dead at max attempts.

Never retry forever or use a single fixed delay.
