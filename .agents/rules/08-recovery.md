# Rule 08: Stuck Job Recovery
Activation: Glob `**/worker/**`

Processing timeout must be configurable.

Jobs stuck in processing beyond that timeout must be recovered to pending with the required attempt increment.
