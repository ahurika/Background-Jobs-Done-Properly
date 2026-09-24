# Skill: Recovery and Dead Letter
Activation: Glob `**/worker/**`, `**/app/jobs/**`, `**/app/api/**`

Recovery detects processing jobs beyond the configured timeout, increments attempts, returns them to pending, and makes them eligible again.

Dead-letter view lists dead jobs, shows payload/attempts/lastError, and supports manual retry.
