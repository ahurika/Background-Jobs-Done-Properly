import { prisma } from '../lib/db/prisma';
import { sendEmail } from '../lib/email/provider';

const BASE_MS = parseInt(process.env.JOB_BACKOFF_BASE_MS || '1000', 10);
const JITTER_MS = parseInt(process.env.JOB_BACKOFF_JITTER_MS || '500', 10);

export async function processJob(job: any) {
  try {
    const payload = JSON.parse(job.payload);
    
    // External work execution with Idempotency Key passed.
    await sendEmail({ ...payload, idempotencyKey: job.id });

    // Mark as succeeded
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
      }
    });
    console.log(`[Job ${job.id}] Succeeded.`);

  } catch (error: any) {
    const lastError = error.message || 'Unknown error';
    const newAttempts = job.attempts + 1;
    console.error(`[Job ${job.id}] Failed: ${lastError} (Attempt ${newAttempts}/${job.maxAttempts})`);

    if (newAttempts >= job.maxAttempts) {
      // Dead state handling
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'dead',
          attempts: newAttempts,
          lastError,
          finishedAt: new Date(),
        }
      });
      console.log(`[Job ${job.id}] Exhausted retries. Status is now DEAD.`);
    } else {
      // Exponential backoff with jitter
      const delay = (BASE_MS * Math.pow(2, newAttempts - 1)) + Math.floor(Math.random() * JITTER_MS);
      const nextRunAt = new Date(Date.now() + delay);
      
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          attempts: newAttempts,
          lastError,
          runAt: nextRunAt,
          startedAt: null, // Reset for next worker claim
        }
      });
      console.log(`[Job ${job.id}] Status set to FAILED. Retrying in ${delay}ms...`);
    }
  }
}
