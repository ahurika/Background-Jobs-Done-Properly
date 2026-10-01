import { prisma } from '../lib/db/prisma';
import { spawn } from 'child_process';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Clearing database...');
  await prisma.job.deleteMany({});

  console.log('1. Creating a SUCCEEDED job...');
  await prisma.job.create({ data: { userId: 'user', type: 'SEND_EMAIL', payload: JSON.stringify({ to: 'success@example.com' }), idempotencyKey: 'key-1', status: 'pending', maxAttempts: 5, runAt: new Date() }});
  
  let worker = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'worker/index.ts'], { shell: true });
  await delay(2000);
  worker.kill();

  console.log('2. Creating a DEAD job...');
  await prisma.job.create({ data: { userId: 'user', type: 'SEND_EMAIL', payload: JSON.stringify({ to: 'fail@example.com' }), idempotencyKey: 'key-2', status: 'pending', maxAttempts: 1, runAt: new Date() }});
  worker = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'worker/index.ts'], { shell: true });
  await delay(3000);
  worker.kill();

  console.log('3. Creating a FAILED job (waiting for retry)...');
  await prisma.job.create({ data: { userId: 'user', type: 'SEND_EMAIL', payload: JSON.stringify({ to: 'fail@example.com' }), idempotencyKey: 'key-3', status: 'pending', maxAttempts: 5, runAt: new Date() }});
  worker = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'worker/index.ts'], { shell: true });
  await delay(1500); // Let it fail once, but kill before retry
  worker.kill();

  console.log('4. Creating a PROCESSING job...');
  await prisma.job.create({ data: { userId: 'user', type: 'SEND_EMAIL', payload: JSON.stringify({ to: 'stuck@example.com' }), idempotencyKey: 'key-4', status: 'pending', maxAttempts: 5, runAt: new Date() }});
  worker = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'worker/index.ts'], { shell: true });
  await delay(150); // Kill it mid-processing
  worker.kill();

  console.log('5. Creating a PENDING job...');
  await prisma.job.create({ data: { userId: 'user', type: 'SEND_EMAIL', payload: JSON.stringify({ to: 'pending@example.com' }), idempotencyKey: 'key-5', status: 'pending', maxAttempts: 5, runAt: new Date() }});
  // Do not run worker for this one.

  console.log('--- DONE! ---');
  console.log('Open Prisma Studio now to see jobs in ALL 5 states simultaneously for your screenshot!');
}

main().catch(console.error);
