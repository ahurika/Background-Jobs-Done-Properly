import { config } from 'dotenv';
import path from 'path';
// Load .env configuration from the project root
config({ path: path.resolve(__dirname, '../.env') });

import { atomicClaim, promoteReadyFailedJobs } from './claim';
import { processJob } from './processor';
import { recoverStuckJobs } from './recovery';

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
let activeJobs = 0;

// Run recovery sweep every 10 seconds
setInterval(recoverStuckJobs, 10000);

async function tick() {
  if (activeJobs >= WORKER_CONCURRENCY) {
    // Reached concurrency limit, wait slightly before checking again
    setTimeout(tick, 100);
    return;
  }

  // Reserve slot synchronously before async claim
  activeJobs++;

  try {
    await promoteReadyFailedJobs();
    const job = await atomicClaim();
    if (job) {
      console.log(`[Worker] Claimed ${job.id} (Active: ${activeJobs}/${WORKER_CONCURRENCY})`);

      // Fire and forget processing to allow concurrent claims
      processJob(job)
        .catch(e => console.error(`[Worker] Fatal processor error on ${job.id}:`, e))
        .finally(() => {
          activeJobs--;
          tick(); // Immediately trigger next poll when capacity frees up
        });

      // Try to pick up another job immediately since we have capacity
      tick();
    } else {
      activeJobs--; // Release slot since no job was claimed
      // No jobs available, backoff polling to save DB resources
      setTimeout(tick, 1000);
    }
  } catch (error) {
    activeJobs--; // Release slot on error
    console.error('[Worker] Claim operation failed:', error);
    // Severe error (e.g. DB disconnect), backoff longer
    setTimeout(tick, 5000);
  }
}

console.log(`=========================================`);
console.log(`Worker Started. Concurrency: ${WORKER_CONCURRENCY}`);
console.log(`=========================================`);
tick();
