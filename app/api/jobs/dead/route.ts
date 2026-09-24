import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      where: { status: 'dead' },
      orderBy: { finishedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ jobs });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
