import request from 'supertest';
import { createApp } from '../server.ts';

jest.mock('../server/db.ts', () => ({
  getPrismaClient: jest.fn().mockReturnValue({
    product: {
      findMany: jest.fn().mockResolvedValue([]),
    }
  })
}));

describe('Products API', () => {
    let app: any;

    beforeAll(async () => {
        app = await createApp();
    });

    it('should reject unauthenticated fetching', async () => {
        const response = await request(app).get('/api/v1/products');
        expect(response.status).toBe(401);
    });
});
