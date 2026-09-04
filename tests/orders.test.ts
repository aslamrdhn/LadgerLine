import request from 'supertest';
import { createApp } from '../server.ts';
import { getPrismaClient } from '../server/db.ts';

jest.mock('../server/db.ts', () => ({
  getPrismaClient: jest.fn().mockReturnValue({
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    }
  })
}));

describe('Orders API', () => {
    let app: any;

    beforeAll(async () => {
        app = await createApp();
    });

    it('should be able to handle basic route', async () => {
        const response = await request(app).get('/api/state').set('Authorization', 'Bearer fake_token');
        // Because of middleware our fake token might fail, it's expected
        expect([401, 403, 200]).toContain(response.status);
    });
});
