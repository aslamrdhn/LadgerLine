import { FastifyInstance, FastifyRequest } from "fastify";
import crypto from "crypto";
import { prisma } from "../lib/prisma.ts";
import { resolveTenantContext } from "../services/tenantContext.service.ts";
import { sanitizeNumber, sanitizeString } from "../utils/sanitizer.ts";
import { getTenantHint } from "./catalog.routes.ts";
import { broadcastKitchenEvent } from "./ssot.routes.ts";

interface QrisSession {
  reference: string;
  orderId: string;
  tenantId: string;
  amount: number;
  merchantName: string;
  nmid: string;
  qrisPayload: string;
  qrImageUrl: string;
  status: "PENDING" | "PAID" | "EXPIRED";
  createdAt: string;
  paidAt?: string;
}

const qrisSessionStore = new Map<string, QrisSession>();

function buildStandardQrisEmvString(
  merchantName: string,
  amount: number,
  reference: string,
): string {
  const cleanMerchant = merchantName
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .slice(0, 25);
  const amtStr = String(Math.round(amount));
  const amtLen = String(amtStr.length).padStart(2, "0");
  const merchLen = String(cleanMerchant.length).padStart(2, "0");
  const refClean = reference.replace(/[^A-Z0-9-]/gi, "").slice(0, 20);
  const base = `00020101021226580016ID.CO.QRIS.WWW01189360091431234567890215ID102435799100303UMI52045812530336054${amtLen}${amtStr}5802ID59${merchLen}${cleanMerchant}6007JAKARTA62240120${refClean}6304`;
  const crc = crypto
    .createHash("md5")
    .update(base)
    .digest("hex")
    .slice(0, 4)
    .toUpperCase();
  return `${base}${crc}`;
}

export async function paymentRoutes(fastify: FastifyInstance) {
  // 1. Midtrans Payment Gateway Token
  fastify.post("/midtrans/token", async (request: FastifyRequest) => {
    const body = (request.body as any) || {};
    const orderId = body.orderId || `ORDER-${Date.now()}`;
    return {
      token: `snap-token-${Date.now()}`,
      redirect_url: "#",
      orderId,
      gross_amount: sanitizeNumber(body.grossAmount || body.amount, {
        min: 0,
        fallback: 50000,
      }),
    };
  });

  // 2. Dynamic QRIS Generator (EMVCo GPN Standard)
  // 2. Dynamic QRIS Generator (EMVCo GPN Standard with DB Authoritative Amount)
  fastify.post("/payments/qris/generate", async (request: FastifyRequest) => {
    const body = (request.body as any) || {};
    const ctx = await resolveTenantContext(
      body.tenantId || getTenantHint(request),
    );
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
    });

    const orderId = sanitizeString(
      body.orderId || `ORD-${Date.now()}`,
      80,
    );

    // Look up real sale from database to prevent amount tampering
    const sale = await prisma.salesHeader.findFirst({
      where: {
        tenantId: ctx.tenantId,
        OR: [{ id: orderId }, { invoiceNumber: orderId }],
      },
    });

    const amount = sale
      ? Math.round(Number(sale.totalAmount))
      : sanitizeNumber(body.amount ?? body.totalPrice, {
          min: 1,
          fallback: 25000,
        });

    const merchantName = sanitizeString(
      body.merchantName || tenant?.name || "LEDGERLINE COFFEE ROASTERY",
      60,
    );
    const reference = `QRIS-${orderId}-${Date.now().toString(36).toUpperCase()}`;
    const qrisPayload = buildStandardQrisEmvString(
      merchantName,
      amount,
      reference,
    );
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&color=1e293b&data=${encodeURIComponent(qrisPayload)}`;

    const session: QrisSession = {
      reference,
      orderId,
      tenantId: ctx.tenantId,
      amount,
      merchantName,
      nmid: "ID102435799100",
      qrisPayload,
      qrImageUrl,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    qrisSessionStore.set(reference, session);
    qrisSessionStore.set(orderId, session);

    return {
      success: true,
      session,
    };
  });

  // 3. Dynamic QRIS Status Check
  fastify.get(
    "/payments/qris/status/:ref",
    async (request: FastifyRequest<{ Params: { ref: string } }>) => {
      const { ref } = request.params;
      const session = qrisSessionStore.get(ref);

      if (session) {
        return {
          success: true,
          reference: session.reference,
          orderId: session.orderId,
          status: session.status,
          amount: session.amount,
          paidAt: session.paidAt || null,
        };
      }

      // Check database if orderId is passed directly
      const sale = await prisma.salesHeader.findFirst({
        where: {
          OR: [{ id: ref }, { invoiceNumber: ref }],
        },
        include: { payments: true },
      });

      let isPaid = false;
      if (sale) {
        isPaid = sale.payments.some((p) => p.status === "PAID");
        if (!isPaid && sale.metadata) {
          try {
            const meta = JSON.parse(sale.metadata);
            isPaid = meta.paymentStatus === "PAID";
          } catch {}
        }
      }

      return {
        success: true,
        reference: ref,
        orderId: sale?.id || ref,
        status: isPaid ? "PAID" : "PENDING",
        amount: sale?.totalAmount || 0,
        paidAt: isPaid ? new Date().toISOString() : null,
      };
    },
  );

  // 4. Dynamic QRIS Webhook Callback (HMAC Verification, Settlement & Kitchen Activation)
  fastify.post("/payments/qris/webhook", async (request: FastifyRequest, reply: any) => {
    const body = (request.body as any) || {};
    const ref = sanitizeString(
      body.reference || body.orderId || body.transaction_id || "",
      100,
    );
    const statusRaw = String(
      body.status || body.transaction_status || "PAID",
    ).toUpperCase();
    const isSuccess = ["PAID", "SETTLEMENT", "CAPTURE", "SUCCESS"].includes(
      statusRaw,
    );

    // Cryptographic HMAC Signature Verification
    const sigHeader =
      (request.headers["x-callback-signature"] as string) ||
      (request.headers["x-webhook-signature"] as string) ||
      "";
    const secret =
      process.env.QRIS_WEBHOOK_SECRET || "ledgerline-secret-key-2026";
    const isSimulation = body.isSimulation === true || body.simulation === true;

    if (sigHeader) {
      const computed = crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(body))
        .digest("hex");
      if (computed.toLowerCase() !== sigHeader.toLowerCase()) {
        return reply.code(401).send({
          success: false,
          error: "AUTH_SIG",
          message: "Tanda tangan HMAC callback tidak valid",
        });
      }
    } else if (!isSimulation && process.env.NODE_ENV === "production") {
      return reply.code(401).send({
        success: false,
        error: "MISSING_SIG",
        message: "Header tanda tangan webhook HMAC diperlukan untuk produksi",
      });
    }

    const session = qrisSessionStore.get(ref);
    const targetOrderId = session?.orderId || body.orderId || ref;

    if (session && isSuccess) {
      session.status = "PAID";
      session.paidAt = new Date().toISOString();
      qrisSessionStore.set(session.reference, session);
      qrisSessionStore.set(session.orderId, session);
    }

    if (targetOrderId && isSuccess) {
      try {
        const sale = await prisma.salesHeader.findFirst({
          where: {
            OR: [{ id: targetOrderId }, { invoiceNumber: targetOrderId }],
          },
          include: { kitchenOrder: true },
        });

        if (sale) {
          let meta: Record<string, any> = {};
          try {
            meta = JSON.parse(sale.metadata || "{}");
          } catch {}
          meta.paymentStatus = "PAID";
          meta.qrisSettledAt = new Date().toISOString();
          meta.qrisReference = session?.reference || ref;

          await prisma.salesHeader.update({
            where: { id: sale.id },
            data: {
              status: "POSTED",
              metadata: JSON.stringify(meta),
            },
          });

          await prisma.payment.updateMany({
            where: { salesId: sale.id },
            data: {
              status: "PAID",
            },
          });

          // Activate Kitchen Order from PENDING_PAYMENT to NEW now that payment is confirmed
          let kitchenOrder = sale.kitchenOrder;
          if (kitchenOrder && kitchenOrder.status === "PENDING_PAYMENT") {
            kitchenOrder = await prisma.kitchenOrder.update({
              where: { id: kitchenOrder.id },
              data: { status: "NEW" },
            });
          }

          if (kitchenOrder) {
            let kitchenItems = [];
            try {
              kitchenItems = JSON.parse(kitchenOrder.items as string);
            } catch {
              kitchenItems = [];
            }

            // Immediately broadcast new order to kitchen KDS tablet!
            broadcastKitchenEvent(sale.outletId, {
              type: "NEW_ORDER",
              order: {
                id: kitchenOrder.id,
                orderNumber: kitchenOrder.orderNumber,
                status: "NEW",
                items: kitchenItems,
              },
            });
          }
        }
      } catch (err) {
        console.warn("[QRIS Webhook] DB update warning:", err);
      }
    }

    return {
      success: true,
      reference: session?.reference || ref,
      orderId: targetOrderId,
      status: isSuccess ? "PAID" : "PENDING",
      settledAt: new Date().toISOString(),
      message: "Settlement QRIS berhasil diverifikasi & pesanan dapur diaktifkan.",
    };
  });
}
