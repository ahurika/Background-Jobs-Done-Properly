import { prisma } from '../lib/db/prisma';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const evidenceDir = path.join(__dirname, '../evidence');
if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir);

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runWorker(name: string, durationMs: number): Promise<string> {
  return new Promise((resolve) => {
    let output = '';
    const worker = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'worker/index.ts'], { 
      env: { ...process.env, WORKER_CONCURRENCY: '5' },
      shell: true
    });
    worker.stdout.on('data', data => { output += data.toString(); });
    worker.stderr.on('data', data => { output += data.toString(); });
    setTimeout(() => {
      worker.kill();
      resolve(output);
    }, durationMs);
  });
}

async function runTest1() {
  console.log('--- Running Test 1: 50 Jobs Concurrency ---');
  await prisma.job.deleteMany({});
  
  // Submit 50 jobs
  const jobs = Array.from({ length: 50 }).map((_, i) => ({
    userId: 'test1',
    type: 'SEND_EMAIL',
    payload: JSON.stringify({ to: `user${i}@example.com` }),
    idempotencyKey: `test1-key-${i}`,
    status: 'pending',
    maxAttempts: 5,
    runAt: new Date()
  }));
  
  await prisma.job.createMany({ data: jobs });
  
  // Run worker for 8 seconds
  const logs = await runWorker('worker1', 8000);
  fs.writeFileSync(path.join(evidenceDir, 'test1_50_jobs_concurrency.txt'), logs);
  console.log('Saved evidence for Test 1.');
}

async function runTest2() {
  console.log('--- Running Test 2: 100% Failure & Backoff ---');
  await prisma.job.deleteMany({});
  
  await prisma.job.create({
    data: {
      userId: 'test2',
      type: 'SEND_EMAIL',
      payload: JSON.stringify({ to: 'fail@example.com' }), // Guaranteed to fail
      idempotencyKey: `test2-fail`,
      maxAttempts: 3, // Small max attempts for fast testing
      status: 'pending',
      runAt: new Date()
    }
  });

  // Run worker long enough to exhaust attempts (3 attempts with backoff)
  const logs = await runWorker('worker1', 12000);
  fs.writeFileSync(path.join(evidenceDir, 'test2_100_percent_failure.txt'), logs);
  
  const deadJob = await prisma.job.findFirst({ where: { status: 'dead' } });
  fs.writeFileSync(path.join(evidenceDir, 'test2_dead_job_db_record.json'), JSON.stringify(deadJob, null, 2));
  console.log('Saved evidence for Test 2.');
}

async function runTest4() {
  console.log('--- Running Test 4: Duplicate Idempotency Key ---');
  await prisma.job.deleteMany({});
  
  let result = '';
  try {
    await prisma.job.create({
      data: {
        userId: 'test4',
        type: 'SEND_EMAIL',
        payload: JSON.stringify({ to: 'dup@example.com' }),
        idempotencyKey: `duplicate-key`,
        status: 'pending',
        maxAttempts: 5,
        runAt: new Date()
      }
    });
    result += 'First insert successful.\n';
    
    await prisma.job.create({
      data: {
        userId: 'test4',
        type: 'SEND_EMAIL',
        payload: JSON.stringify({ to: 'dup@example.com' }),
        idempotencyKey: `duplicate-key`,
        status: 'pending',
        maxAttempts: 5,
        runAt: new Date()
      }
    });
  } catch (e: any) {
    result += `Second insert failed as expected: ${e.code} - ${e.message}\n`;
  }
  
  fs.writeFileSync(path.join(evidenceDir, 'test4_duplicate_idempotency.txt'), result);
  console.log('Saved evidence for Test 4.');
}

async function main() {
  await runTest1();
  await runTest2();
  await runTest4();
  console.log('Tests complete.');
}

main().catch(console.error);
