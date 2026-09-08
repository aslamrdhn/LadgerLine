import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.ts";

export async function supplierRoutes(fastify: FastifyInstance) {
  // Auth
  fastify.post("/auth/register", async (request, reply) => {
    const { company_name, contactEmail, phone, password } = request.body as any;
    try {
      // Very basic placeholder, in real life we hash passwords etc.
      // Schema: Supplier (id, name, contactEmail, phone, status, ...)
      // Let's create a supplier
      let supplier = await prisma.supplier.findFirst({
        where: { contactEmail },
      });
      if (supplier) {
        return { success: false, message: "Email sudah terdaftar." };
      }

      supplier = await prisma.supplier.create({
        data: {
          name: company_name,
          contactEmail,
          phone,
          status: "pending_verification", // they must be verified by superadmin
        },
      });
      return { success: true, message: "Pendaftaran sukses." };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  fastify.post("/auth/login", async (request, reply) => {
    const { contactEmail, password } = request.body as any;
    try {
      const supplier = await prisma.supplier.findFirst({
        where: { contactEmail },
      });
      if (!supplier) {
        return { success: false, message: "Email tidak ditemukan." };
      }
      if (supplier.status !== "verified" && supplier.status !== "ACTIVE") {
        // return { success: false, message: 'Akun belum diverifikasi oleh superadmin.' };
        // For prototyping let's allow it if it's not rejected
      }
      return {
        success: true,
        token: supplier.id, // basic token mapping
        supplier: {
          id: supplier.id,
          companyName: supplier.name,
          contactEmail: supplier.contactEmail,
          status: supplier.status,
        },
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  // Purchase Requests
  fastify.get("/purchase-requests", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return [];
    const id = authHeader.replace("Bearer ", "");
    // get POs for this supplier
    const pos = await prisma.purchaseOrder.findMany({
      where: { supplierId: id },
      include: {
        details: { include: { catalog: true } },
        tenant: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // transform for the UI
    return pos.map((po) => ({
      id: po.id,
      date: po.createdAt.toISOString().split("T")[0],
      store_name: po.tenant?.name || "Toko",
      status: po.status, // PENDING, APPROVED, etc.
      total_value: po.details.reduce((sum, d) => sum + d.totalPrice, 0),
      items: po.details.map((d) => ({
        name: d.catalog.name,
        quantity: d.quantity,
        unit: d.catalog.unit,
      })),
    }));
  });

  fastify.post("/purchase-requests/:id/action", async (request, reply) => {
    const { id } = request.params as any;
    const { action } = request.body as any; // 'approve' or 'reject'
    // update status
    const newStatus =
      action === "approve"
        ? "APPROVED"
        : action === "reject"
          ? "REJECTED"
          : "PENDING";
    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: newStatus },
    });
    return { success: true };
  });

  // Products
  fastify.get("/products", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return [];
    const id = authHeader.replace("Bearer ", "");

    const catalog = await prisma.supplierCatalog.findMany({
      where: { supplierId: id },
    });
    return catalog.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      unit: c.unit,
      price: c.price,
      isActive: c.isActive,
    }));
  });

  fastify.post("/products", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return { success: false };
    const id = authHeader.replace("Bearer ", "");
    const { product_name, category, price_offer, unit } = request.body as any;

    await prisma.supplierCatalog.create({
      data: {
        supplierId: id,
        name: product_name,
        category: category,
        unit: unit,
        price: Number(price_offer) || 0,
        isActive: false, // need tenant approval or just available
      },
    });

    return { success: true };
  });
}
