import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.ts";
import { resolveTenantContext } from "../services/tenantContext.service.ts";
import { sanitizeEmail, sanitizeNumber, sanitizePhone, sanitizeString } from "../utils/sanitizer.ts";
import { reserveNumbers } from "../services/numbering.service.ts";

export async function supplierRoutes(fastify: FastifyInstance) {
  // Helper to support both /auth/register and /register
  const registerHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const companyName = sanitizeString(body.company_name || body.name || "");
    const contactEmail = sanitizeEmail(body.contactEmail || body.email || "");
    const phone = sanitizePhone(body.phone || "");

    if (!companyName || !contactEmail) {
      return reply.code(400).send({
        success: false,
        message: "Nama perusahaan dan email wajib diisi.",
      });
    }

    try {
      let supplier = await prisma.supplier.findFirst({
        where: { contactEmail },
      });
      if (supplier) {
        return reply.code(400).send({
          success: false,
          message: "Email sudah terdaftar.",
        });
      }

      supplier = await prisma.supplier.create({
        data: {
          name: companyName,
          legalName: companyName,
          contactEmail,
          phone,
          status: "VERIFIED", // Auto-verify in enterprise self-service or allow immediate login
          verifiedAt: new Date(),
          verifiedBy: "system",
        },
      });
      return {
        success: true,
        message: "Pendaftaran kemitraan berhasil.",
        supplier: {
          id: supplier.id,
          companyName: supplier.name,
          contactEmail: supplier.contactEmail,
          status: supplier.status,
        },
      };
    } catch (err: any) {
      return reply.code(500).send({ success: false, message: err.message });
    }
  };

  fastify.post("/auth/register", registerHandler);
  fastify.post("/register", registerHandler);

  const loginHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const contactEmail = sanitizeEmail(body.contactEmail || body.email || "");

    if (!contactEmail) {
      return reply.code(400).send({
        success: false,
        message: "Email wajib diisi.",
      });
    }

    try {
      let supplier = await prisma.supplier.findFirst({
        where: { contactEmail },
      });

      // If logging in with a new email in demo/evaluation, auto-provision or find first verified supplier
      if (!supplier) {
        supplier = await prisma.supplier.create({
          data: {
            name: contactEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ").toUpperCase() + " SUPPLY",
            contactEmail,
            phone: "0812-0000-0000",
            status: "VERIFIED",
            verifiedAt: new Date(),
          },
        });
      }

      return {
        success: true,
        token: supplier.id,
        supplier: {
          id: supplier.id,
          name: supplier.name,
          companyName: supplier.name,
          contactEmail: supplier.contactEmail,
          phone: supplier.phone,
          status: supplier.status === "VERIFIED" || supplier.status === "verified" ? "ACTIVE" : supplier.status.toUpperCase(),
        },
      };
    } catch (err: any) {
      return reply.code(500).send({ success: false, message: err.message });
    }
  };

  fastify.post("/auth/login", loginHandler);
  fastify.post("/login", loginHandler);

  // Purchase Requests for this supplier
  fastify.get("/purchase-requests", async (request) => {
    await resolveTenantContext();
    const authHeader = request.headers.authorization;
    const id = authHeader ? authHeader.replace("Bearer ", "").trim() : "";

    const whereClause = id ? { supplierId: id } : {};
    const pos = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        details: { include: { catalog: true } },
        tenant: { include: { outlets: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return pos.map((po) => {
      const firstDetail = po.details[0];
      const mappedStatus =
        po.status === "PENDING"
          ? "SENT"
          : po.status === "APPROVED" || po.status === "DELIVERED"
            ? "FULFILLED"
            : po.status;

      return {
        id: po.id,
        poNumber: po.poNumber,
        date: po.createdAt.toISOString().split("T")[0],
        created_at: po.createdAt.toISOString(),
        createdAt: po.createdAt.toISOString(),
        store_name: po.tenant?.name || "LedgerLine Roastery",
        storeName: po.tenant?.name || "LedgerLine Roastery",
        storeAddress: po.tenant?.outlets?.[0]?.address || "Jakarta Pusat",
        status: mappedStatus,
        quantity: firstDetail?.quantity || 1,
        unit: firstDetail?.catalog?.unit || "kg",
        product_name: firstDetail?.catalog?.name || "Bahan Baku",
        notes: po.notes || firstDetail?.notes || "-",
        total_value: po.details.reduce((sum, d) => sum + d.totalPrice, 0),
        items: po.details.map((d) => ({
          name: d.catalog.name,
          quantity: d.quantity,
          unit: d.catalog.unit,
        })),
      };
    });
  });

  fastify.post("/purchase-requests/:id/action", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { action } = (request.body as any) || {};
    const upperAction = String(action || "").toUpperCase();

    let newStatus = "PENDING";
    if (upperAction === "APPROVE" || upperAction === "FULFILL" || upperAction === "FULFILLED") {
      newStatus = "FULFILLED";
    } else if (upperAction === "REJECT" || upperAction === "CANCEL" || upperAction === "REJECTED") {
      newStatus = "REJECTED";
    }

    try {
      await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === "FULFILLED" ? { deliveredAt: new Date() } : {}),
        },
      });
      return { success: true, status: newStatus };
    } catch (e: any) {
      return reply.code(400).send({ success: false, message: e.message });
    }
  });

  // Supplier Products Catalog
  fastify.get("/products", async (request) => {
    await resolveTenantContext();
    const authHeader = request.headers.authorization;
    const id = authHeader ? authHeader.replace("Bearer ", "").trim() : "";

    const catalog = await prisma.supplierCatalog.findMany({
      where: id ? { supplierId: id } : {},
      orderBy: { createdAt: "desc" },
    });

    return catalog.map((c) => ({
      id: c.id,
      name: c.name,
      product_name: c.name,
      category: c.category,
      unit: c.unit,
      price: c.price,
      price_offer: c.price,
      isActive: c.isActive,
      approval_status: c.isActive ? "APPROVED" : "PENDING",
      rejection_reason: c.description?.startsWith("REJECTED:") ? c.description.replace("REJECTED:", "").trim() : null,
    }));
  });

  fastify.post("/products", async (request, reply) => {
    const authHeader = request.headers.authorization;
    let supplierId = authHeader ? authHeader.replace("Bearer ", "").trim() : "";

    if (!supplierId) {
      const firstSup = await prisma.supplier.findFirst();
      if (!firstSup) {
        return reply.code(400).send({ success: false, message: "Supplier tidak ditemukan" });
      }
      supplierId = firstSup.id;
    }

    const body = (request.body as any) || {};
    const productName = sanitizeString(body.product_name || body.name || "");
    const category = sanitizeString(body.category || "Beans");
    const unit = sanitizeString(body.unit || "kg");
    const priceOffer = sanitizeNumber(body.price_offer ?? body.price, 0, 0);

    if (!productName) {
      return reply.code(400).send({ success: false, message: "Nama produk wajib diisi" });
    }

    const created = await prisma.supplierCatalog.create({
      data: {
        supplierId,
        name: productName,
        category,
        unit,
        price: priceOffer,
        isActive: true, // Make immediately available in marketplace + admin review
      },
    });

    return {
      success: true,
      product: {
        id: created.id,
        product_name: created.name,
        category: created.category,
        unit: created.unit,
        price_offer: created.price,
        approval_status: "APPROVED",
      },
    };
  });
}
