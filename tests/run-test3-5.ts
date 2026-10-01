import { prisma } from '../lib/db/prisma';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const evidenceDir = path.join(__dirname, '../evidence');
if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir);

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest3() {
  console.log('--- Running Test 3: Worker Kill & Recovery ---');
  await prisma.job.deleteMany({});
  
  const job = await prisma.job.create({
    data: {
      userId: 'test3',
      type: 'SEND_EMAIL',
      payload: JSON.stringify({ to: `user-test3@example.com` }),
      idempotencyKey: `test3-key`,
      status: 'pending',
      maxAttempts: 5,
      runAt: new Date()
    }
  });

  let output = '';
  const worker1 = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'worker/index.ts'], { 
    env: { ...process.env, WORKER_CONCURRENCY: '1' }, shell: true 
  });
  worker1.stdout.on('data', d => { output += d.toString(); });
  
  await delay(150);
  worker1.kill();
  output += '\n[Test Runner] Worker killed mid-processing.\n';
  
  const stuckJob = await prisma.job.findUnique({ where: { id: job.id } });
  output += `\n[DB state after kill] Status: ${stuckJob?.status}\n`;

  const { recoverStuckJobs } = require('../worker/recovery');
  process.env.JOB_PROCESSING_TIMEOUT_MS = '0'; // force immediate recovery
  await recoverStuckJobs();
  
  const recoveredJob = await prisma.job.findUnique({ where: { id: job.id } });
  output += `\n[DB state after recovery] Status: ${recoveredJob?.status}, Attempts: ${recoveredJob?.attempts}\n`;

  const worker2 = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'worker/index.ts'], { 
    env: { ...process.env, WORKER_CONCURRENCY: '1' }, shell: true 
  });
  worker2.stdout.on('data', d => { output += d.toString(); });
  await delay(3000);
  worker2.kill();
  
  const finalJob = await prisma.job.findUnique({ where: { id: job.id } });
  output += `\n[DB state final] Status: ${finalJob?.status}\n`;
  
  fs.writeFileSync(path.join(evidenceDir, 'test3_worker_kill_recovery.txt'), output);
  console.log('Saved evidence for Test 3.');
}

async function runTest5() {
  console.log('--- Running Test 5: Two Workers ---');
  await prisma.job.deleteMany({});
  
  const jobs = Array.from({ length: 20 }).map((_, i) => ({
    userId: 'test5',
    type: 'SEND_EMAIL',
    payload: JSON.stringify({ to: `user${i}@example.com` }),
    idempotencyKey: `test5-key-${i}`,
    status: 'pending',
    maxAttempts: 5,
    runAt: new Date()
  }));
  await prisma.job.createMany({ data: jobs });

  let output = '';
  const worker1 = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'worker/index.ts'], { shell: true });
  const worker2 = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'worker/index.ts'], { shell: true });
  
  worker1.stdout.on('data', d => { output += '[W1] ' + d.toString(); });
  worker2.stdout.on('data', d => { output += '[W2] ' + d.toString(); });
  
  await delay(5000);
  worker1.kill();
  worker2.kill();
  
  fs.writeFileSync(path.join(evidenceDir, 'test5_two_workers.txt'), output);
  console.log('Saved evidence for Test 5.');
}

async function main() {
  await runTest3();
  await runTest5();
  console.log('Tests complete.');
}

main().catch(console.error);
