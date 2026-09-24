# Skill: Worker
Activation: Glob `**/worker/**`

The worker is a separate process.

Implement pending-job polling, atomic claim, configured concurrency, processing, success transition, and failure transition.

Never use read-then-write claiming.
