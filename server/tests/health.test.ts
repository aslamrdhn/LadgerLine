import supertest from "supertest";
import { createApp } from "../../server.ts";

describe("Health Check API", () => {
  let app: any;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health should return 200 OK", async () => {
    const response = await supertest(app.server).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "healthy");
    expect(response.body).toHaveProperty("database");
  });
});
