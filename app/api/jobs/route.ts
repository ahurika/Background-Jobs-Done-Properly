import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/db/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, type, payload, idempotencyKey } = body;

    if (!userId || !type || !payload || !idempotencyKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type !== 'SEND_EMAIL') {
      return NextResponse.json({ error: 'Unsupported job type' }, { status: 400 });
    }

    const maxAttempts = parseInt(process.env.JOB_MAX_ATTEMPTS || '5', 10);
    const runAt = new Date();

    try {
      const job = await prisma.job.create({
        data: {
          userId,
          type,
          payload: JSON.stringify(payload),
          idempotencyKey,
          status: 'pending',
          maxAttempts,
          runAt,
        }
      });
      return NextResponse.json({ id: job.id, status: job.status, message: 'Job enqueued' }, { status: 202 });
    } catch (e: any) {
      // P2002 is Prisma's unique constraint violation error code
      if (e.code === 'P2002') {
        const existingJob = await prisma.job.findUnique({
          where: { idempotencyKey }
        });
        if (existingJob) {
          return NextResponse.json({ id: existingJob.id, status: existingJob.status, message: 'Job already exists' }, { status: 202 });
        }
      }
      throw e;
    }
  } catch (error) {
    console.error('Enqueue error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
