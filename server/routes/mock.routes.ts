import { FastifyInstance } from 'fastify';

export async function mockRoutes(fastify: FastifyInstance) {
  fastify.get('/admin/suppliers', async () => []);
  fastify.get('/admin/products/pending', async () => []);
  fastify.get('/admin/migration-tickets', async () => []);
  fastify.get('/admin/tenants', async () => []);
  fastify.get('/admin/purchase-requests', async () => []);
  
  fastify.get('/bi/profit-leaks', async () => []);
  fastify.get('/bi/insights', async () => []);
  fastify.get('/bi/benchmarks', async () => []);

  fastify.get('/demand/global-demand', async () => ({ trends: [], alerts: [] }));
}
