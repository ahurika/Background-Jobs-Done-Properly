# Rule 09: Idempotent Work
Activation: Glob `**/lib/email/**`, `**/worker/**`

Email work must tolerate a worker crash after external work succeeds but before the database records success.

Use job identity or an equivalent provider-supported mechanism to prevent unintended duplicate delivery.
