import { prisma } from '../lib/db/prisma';

const TIMEOUT_MS = parseInt(process.env.JOB_PROCESSING_TIMEOUT_MS || '60000', 10);

export async function recoverStuckJobs() {
  try {
    const cutoffTime = new Date(Date.now() - TIMEOUT_MS);
    
    // Find all jobs that have been 'processing' since before cutoffTime
    const stuckJobs = await prisma.job.findMany({
      where: {
        status: 'processing',
        startedAt: { lte: cutoffTime },
      }
    });

    if (stuckJobs.length > 0) {
      console.log(`[Recovery] Found ${stuckJobs.length} stuck processing jobs.`);
      for (const job of stuckJobs) {
        const newAttempts = job.attempts + 1; 
        
        await prisma.job.updateMany({
          where: { id: job.id, status: 'processing' }, // Prevent resetting if status changed concurrently
          data: {
            status: 'pending',
            attempts: newAttempts,
            runAt: new Date(), // Make eligible immediately
            startedAt: null,
            lastError: 'Stuck processing timeout recovery',
          }
        });
        console.log(`[Recovery] Reset job ${job.id} to pending (Attempts: ${newAttempts}).`);
      }
    }
  } catch (error) {
    console.error('[Recovery] Error running recovery sweep:', error);
  }
}
