import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db/prisma';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const job = await prisma.job.findUnique({
      where: { id }
    });

    if (!job || job.status !== 'dead') {
      return NextResponse.json({ error: 'Only dead jobs can be retried' }, { status: 400 });
    }

    // Manual retry: reset to pending, keep attempt count but reset to 0 so it gets a fresh batch
    // This preserves the ID and timestamps (history) but makes it eligible again
    await prisma.job.update({
      where: { id },
      data: {
        status: 'pending',
        attempts: 0,
        runAt: new Date(),
        startedAt: null,
      }
    });

    return NextResponse.json({ success: true, message: 'Job retried' });
  } catch (error) {
    console.error('Retry error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
