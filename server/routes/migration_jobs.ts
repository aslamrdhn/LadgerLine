import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authorizeRole } from '../middlewares/auth.js';

const prisma = new PrismaClient();
export const migrationJobsRouter = Router();

migrationJobsRouter.post('/', authorizeRole(['Owner', 'superadmin', 'SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, mappedData } = req.body;
    
    // validasi data
    const errors: any[] = [];
    const previewData: any[] = [];
    
    for (let i=0; i<mappedData.length; i++) {
      const row = mappedData[i];
      if (!row.name) {
        errors.push({ rowNumber: i + 1, errorMessage: 'Missing product name' });
      } else {
        previewData.push({ ...row });
      }
    }

    const job = await prisma.migrationJob.create({
      data: {
        tenantId,
        status: errors.length > 0 ? 'FAILED' : 'PREVIEW',
        previewData,
        errorData: errors,
        logs: {
          create: [{ action: 'VALIDATION', details: `Validated ${mappedData.length} rows. Found ${errors.length} errors.` }]
        },
        errors: {
          create: errors.map((e: any) => ({ rowNumber: e.rowNumber, errorMessage: e.errorMessage }))
        }
      },
      include: { errors: true, logs: true }
    });

    res.json(job);
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

migrationJobsRouter.post('/:id/import', authorizeRole(['Owner', 'superadmin', 'SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await prisma.migrationJob.findUnique({ where: { id: req.params.id } });
    if (!job || job.status !== 'PREVIEW') {
      return res.status(400).json({ error: 'Job not found or not in PREVIEW state' });
    }

    const tenantId = job.tenantId;
    const previewData: any[] = job.previewData as any[];
    
    const createdIds: string[] = [];
    for (const p of previewData) {
      const created = await prisma.product.create({
        data: {
          id: `mig-${job.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          tenantId: tenantId,
          name: p.name,
          category: p.category || 'Uncategorized',
          price: Number(p.price) || 0,
          costPrice: Number(p.costPrice) || 0,
          stock: Number(p.stock) || 0,
          warningLimit: 10
        }
      });
      createdIds.push(created.id);
    }

    const updatedJob = await prisma.migrationJob.update({
      where: { id: job.id },
      data: {
        status: 'IMPORTED',
        previewData: createdIds // Save imported IDs for rollback
      }
    });

    await prisma.migrationLog.create({
      data: { jobId: job.id, action: 'IMPORT', details: `Imported ${createdIds.length} products.` }
    });

    res.json(updatedJob);
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

migrationJobsRouter.post('/:id/rollback', authorizeRole(['Owner', 'superadmin', 'SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await prisma.migrationJob.findUnique({ where: { id: req.params.id } });
    if (!job || job.status !== 'IMPORTED') {
      return res.status(400).json({ error: 'Job not found or not in IMPORTED state' });
    }

    const createdIds = job.previewData as string[];
    
    if (createdIds && createdIds.length > 0) {
      await prisma.product.deleteMany({
        where: { id: { in: createdIds } }
      });
    }

    const updatedJob = await prisma.migrationJob.update({
      where: { id: job.id },
      data: { status: 'ROLLED_BACK' }
    });

    await prisma.migrationLog.create({
      data: { jobId: job.id, action: 'ROLLBACK', details: `Rolled back ${createdIds?.length || 0} products.` }
    });

    res.json(updatedJob);
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

migrationJobsRouter.get('/:id', authorizeRole(['Owner', 'superadmin', 'SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const job = await prisma.migrationJob.findUnique({ 
      where: { id: req.params.id },
      include: { errors: true, logs: true }
    });
    res.json(job);
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});
