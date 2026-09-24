# Rule 06: Worker Concurrency
Activation: Glob `**/worker/**`

Worker concurrency must come from centralized configuration.

Never exceed the configured concurrency. Logs must make the concurrency cap observable for the 50-job evidence test.
