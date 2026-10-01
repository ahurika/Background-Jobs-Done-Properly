# Rule 03: Job Lifecycle
Activation: Glob `**/prisma/**`, `**/lib/jobs/**`

The Job lifecycle contains exactly:
`pending`, `processing`, `succeeded`, `failed`, `dead`.

Never remove `dead`. Keep `failed` and `dead` semantically distinct. Preserve attempts and timestamps.
