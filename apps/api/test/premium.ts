import type { PrismaService } from '../src/prisma/prisma.service.js';

const MS_IN_DAY = 24 * 60 * 60 * 1000;

/** Gives a learner a paid month in one step, for tests of what Premium opens. */
export async function grantPremium(prisma: PrismaService, userId: string): Promise<void> {
  const currentPeriodEnd = new Date(Date.now() + 30 * MS_IN_DAY);
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, planKey: 'month', status: 'active', currentPeriodEnd },
    update: { planKey: 'month', status: 'active', currentPeriodEnd },
  });
}
