# Rule 05: Atomic Claim
Activation: Glob `**/worker/**`

Job claiming must atomically transition `pending` to `processing`.

Never implement claiming as a separate read followed by a later write. Two workers must not be able to win the same job.
