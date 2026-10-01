# Rule 10: Central Configuration
Activation: Glob `**/lib/config/**`

Operational values must be centralized, including concurrency, max attempts, backoff, jitter, and processing timeout.

Do not scatter hard-coded operational values through handlers or worker logic.
