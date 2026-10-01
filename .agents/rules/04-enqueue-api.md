# Rule 04: Enqueue API
Activation: Glob `**/app/api/**`

The enqueue path validates input, persists a pending job, returns HTTP 202, and exits.

Never perform email work or wait for the worker inside the request handler.
