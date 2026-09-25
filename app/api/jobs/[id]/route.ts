import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const job = await prisma.job.findUnique({
      where: { id }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError,
      runAt: job.runAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
