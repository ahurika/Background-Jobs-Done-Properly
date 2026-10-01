import { prisma } from '../lib/db/prisma';

async function main() {
  const result = await prisma.job.deleteMany({});
  console.log(`Successfully cleared ${result.count} jobs from the database.`);
}

main().catch(console.error).finally(() => process.exit(0));
