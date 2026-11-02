import { prisma, withTenant, PrismaTransaction } from "../lib/prisma.ts";
import { closePeriod } from "../services/period.service.ts";
import { getBusinessDate } from "../utils/timezone.ts";

const MAX_WAIT_ATTEMPTS = 60;
const WAIT_INTERVAL = 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dailyClosing(tenantId: string) {
  let attempts = 0;
  let allFifoJobsDone = false;

  while (!allFifoJobsDone && attempts < MAX_WAIT_ATTEMPTS) {
    attempts++;
    const pendingJobs = await prisma.fifoAllocationJob.count({
      where: {
        tenantId,
        status: { in: ["PENDING", "PROCESSING"] },
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    if (pendingJobs === 0) {
      allFifoJobsDone = true;
    } else {
      console.log(
        `⏳ Waiting for ${pendingJobs} FIFO jobs to complete for tenant ${tenantId} (attempt ${attempts})`,
      );
      await sleep(WAIT_INTERVAL);
    }
  }

  if (!allFifoJobsDone) {
    console.error(
      `⚠️ Timeout waiting for FIFO jobs for tenant ${tenantId} after ${MAX_WAIT_ATTEMPTS} attempts`,
    );
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: "system",
        action: "CLOSING_TIMEOUT",
        severity: "critical",
        metadata: JSON.stringify({
          message: `Daily closing timeout waiting for FIFO jobs after ${MAX_WAIT_ATTEMPTS}) attempts`,
        }),
      },
    });
  }

  await withTenant(tenantId, async (tx: PrismaTransaction) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });

    if (!tenant) {
      console.log(`Tenant ${tenantId} not found`);
      return;
    }

    const today = getBusinessDate(
      tenant.timezone || "Asia/Jakarta",
      new Date(),
    );
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Only auto-close periods whose endDate has passed (end of month/period),
    // never close the currently active open period in the middle of the workday!
    const expiredOpenPeriod = await tx.period.findFirst({
      where: {
        tenantId,
        endDate: { lt: startOfDay },
        status: "OPEN",
      },
      orderBy: { startDate: "asc" },
    });

    if (!expiredOpenPeriod) {
      return;
    }

    await closePeriod(tx, tenantId, expiredOpenPeriod.id, "SOFT_CLOSED");

    const existingArchive = await tx.archiveJob.findFirst({
      where: {
        tenantId,
        periodId: expiredOpenPeriod.id,
        reportType: "DAILY_CLOSING",
      },
    });
    if (!existingArchive) {
      await tx.archiveJob.create({
        data: {
          tenantId,
          periodId: expiredOpenPeriod.id,
          reportType: "DAILY_CLOSING",
          status: "PENDING",
        },
      });
    }

    await tx.outbox.create({
      data: {
        tenantId,
        eventType: "PeriodClosed",
        payload: JSON.stringify({
          periodId: expiredOpenPeriod.id,
          tenantId,
          date: startOfDay.toISOString().split("T")[0],
        }),
      },
    });

    console.log(
      `📄 Period closing completed for tenant ${tenantId} on period ${expiredOpenPeriod.name}. Archive job created.`,
    );
  });
}

export async function startDailyClosingCron() {
  console.log(
    "📅 Daily Closing Cron started (with timezone-aware per-tenant closing)",
  );

  setInterval(
    async () => {
      try {
        const tenants = await prisma.tenant.findMany({
          where: { status: "active" },
          select: { id: true },
        });

        for (const tenant of tenants) {
          try {
            await dailyClosing(tenant.id);
          } catch (error: any) {
            console.error(
              `❌ Daily closing failed for tenant ${tenant.id}:`,
              error.message,
            );
          }
        }
      } catch (error: any) {
        console.error("❌ Daily closing cron error:", error.message);
      }
    },
    60 * 60 * 1000,
  ); // Check hourly
}
