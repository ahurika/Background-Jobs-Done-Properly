import { prisma } from '../lib/db/prisma';

async function main() {
  console.log('Clearing database...');
  await prisma.job.deleteMany({});

  const farFuture = new Date(Date.now() + 1000000000); // Prevents any rogue workers from stealing the job

  console.log('Inserting PENDING job...');
  await prisma.job.create({ 
    data: { userId: 'test', type: 'SEND_EMAIL', payload: JSON.stringify({ to: 'pending@example.com' }), idempotencyKey: 's-1', status: 'pending', maxAttempts: 5, runAt: farFuture }
  });

  console.log('Inserting PROCESSING job...');
  await prisma.job.create({ 
    data: { userId: 'test', type: 'SEND_EMAIL', payload: JSON.stringify({ to: 'processing@example.com' }), idempotencyKey: 's-2', status: 'processing', maxAttempts: 5, runAt: new Date(), startedAt: new Date() }
  });

  console.log('Inserting FAILED job...');
  await prisma.job.create({ 
    data: { userId: 'test', type: 'SEND_EMAIL', payload: JSON.stringify({ to: 'failed@example.com' }), idempotencyKey: 's-3', status: 'failed', attempts: 2, lastError: 'Email API timeout', maxAttempts: 5, runAt: farFuture }
  });

  console.log('Inserting SUCCEEDED job...');
  await prisma.job.create({ 
    data: { userId: 'test', type: 'SEND_EMAIL', payload: JSON.stringify({ to: 'succeeded@example.com' }), idempotencyKey: 's-4', status: 'succeeded', attempts: 1, maxAttempts: 5, runAt: new Date(), startedAt: new Date(), finishedAt: new Date() }
  });

  console.log('Inserting DEAD job...');
  await prisma.job.create({ 
    data: { userId: 'test', type: 'SEND_EMAIL', payload: JSON.stringify({ to: 'dead@example.com' }), idempotencyKey: 's-5', status: 'dead', attempts: 5, lastError: 'Max attempts reached', maxAttempts: 5, runAt: new Date(), startedAt: new Date(), finishedAt: new Date() }
  });

  console.log('--- ALL DONE ---');
}

main().catch(console.error).finally(() => process.exit(0));
