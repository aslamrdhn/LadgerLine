import { Router } from "express";
import { getPrismaClient } from "../db.ts";

export const apiRouter = Router();

apiRouter.get("/products", async (req, res) => {
  try {
    const prisma = getPrismaClient();
    const items = await prisma.item.findMany();
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get("/admin/tenants", async (req, res) => {
  try {
    const prisma = getPrismaClient();
    const tenants = await prisma.tenant.findMany();
    res.json({ success: true, data: tenants });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get("/admin/suppliers", async (req, res) => {
  try {
    const prisma = getPrismaClient();
    const suppliers = await prisma.supplier.findMany();
    res.json({ success: true, data: suppliers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Wildcard for missing APIs so frontend doesn't crash on undefined properties
apiRouter.all("*", (req, res) => {
  res.json({ success: true, data: [], message: "Endpoint under construction after major overhaul" });
});
