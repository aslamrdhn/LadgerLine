import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authorizeRole } from '../middlewares/auth.js';

const prisma = new PrismaClient();
export const migrationRouter = Router();

// 1. Get all migration requests
migrationRouter.get('/requests', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requests = await prisma.migrationRequest.findMany({
      include: {
        tenant: true,
        files: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Create a migration request
migrationRouter.post('/requests', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, previousPos, deadline, notes, assignedStaff } = req.body;
    const request = await prisma.migrationRequest.create({
      data: {
        tenantId,
        previousPos,
        deadline: deadline ? new Date(deadline) : null,
        notes,
        assignedStaff,
      }
    });
    res.json(request);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get specific request details
migrationRouter.get('/requests/:id', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const request = await prisma.migrationRequest.findUnique({
      where: { id: req.params.id },
      include: {
        tenant: true,
        files: true
      }
    });
    res.json(request);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update migration request status
migrationRouter.patch('/requests/:id/status', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    // status should follow: FILE_RECEIVED -> MAPPING -> VALIDATION -> IMPORT_READY -> IMPORTED -> COMPLETED
    const request = await prisma.migrationRequest.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json(request);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Upload migration file (FILE_RECEIVED)
migrationRouter.post('/requests/:id/files', authorizeRole(['Owner', 'superadmin', 'SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileName, fileType, fileUrl, sourceSystem, uploadedBy } = req.body;
    const file = await prisma.migrationFile.create({
      data: {
        migrationRequestId: req.params.id,
        fileName,
        fileType,
        fileUrl,
        sourceSystem,
        uploadedBy
      }
    });

    // Automatically transition to FILE_RECEIVED
    await prisma.migrationRequest.update({
      where: { id: req.params.id },
      data: { status: 'FILE_RECEIVED' }
    });

    res.json(file);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Execute Import
migrationRouter.post('/requests/:id/import', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mappedProducts, tenantId } = req.body;

    if (!mappedProducts || !Array.isArray(mappedProducts) || !tenantId) {
      return res.status(400).json({ error: 'mappedProducts array and tenantId are required' });
    }

    const created = await Promise.all(
      mappedProducts.map(async (p: any) => {
        return await prisma.product.create({
          data: {
            id: `prod-${tenantId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            tenantId: tenantId,
            name: p.name,
            category: p.category || 'Uncategorized',
            price: Number(p.price) || 0,
            costPrice: Number(p.costPrice) || 0,
            stock: Number(p.stock) || 0,
            warningLimit: 10
          }
        });
      })
    );

    // Update status to IMPORTED, then logic can move it to COMPLETED later
    await prisma.migrationRequest.update({
      where: { id: req.params.id },
      data: { status: 'IMPORTED' }
    });

    res.json({ success: true, imported: created.length });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Templates
migrationRouter.get('/templates', authorizeRole(['SUPER_ADMIN', 'Owner']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templates = await prisma.mappingTemplate.findMany();
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

migrationRouter.post('/templates', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, sourceSystem, mappingJson } = req.body;
    const template = await prisma.mappingTemplate.create({
      data: {
        name,
        sourceSystem,
        mappingJson
      }
    });
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
