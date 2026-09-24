import { prisma } from '../lib/db/prisma';

export async function atomicClaim() {
  const now = new Date();
  
  // Atomic claim using one database operation.
  // We use RETURNING to fetch the exact row that was updated.
  const result = await prisma.$queryRaw<any[]>`
    UPDATE Job
    SET status = 'processing', startedAt = ${now}, updatedAt = ${now}
    WHERE id = (
      SELECT id FROM Job
      WHERE status = 'pending' AND runAt <= ${now}
      ORDER BY runAt ASC
      LIMIT 1
    )
    RETURNING *;
  `;

  if (Array.isArray(result) && result.length > 0) {
    const job = result[0];
    return {
      ...job,
      attempts: Number(job.attempts),
      maxAttempts: Number(job.maxAttempts),
      runAt: new Date(job.runAt),
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt),
    };
  }
  return null;
}
