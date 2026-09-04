import request from 'supertest';
import { createApp } from '../server.ts';

jest.mock('../server/db.ts', () => ({
  getPrismaClient: jest.fn().mockReturnValue({
    tenant: {
      findUnique: jest.fn().mockResolvedValue(null),
    }
  })
}));

describe('Auth API', () => {
    let app: any;

    beforeAll(async () => {
        app = await createApp();
    });

    it('should fail login without email', async () => {
        const response = await request(app)
            .post('/api/login')
            .send({});
            
        expect([400, 401]).toContain(response.status); // Bad Request or Unauthorized
    });
});
