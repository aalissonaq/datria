process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "mysql://root:@localhost:3306/datria_test";
process.env.API_PORT = "3000";
process.env.WEB_ORIGIN = "http://localhost:5173";

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Health Endpoints (e2e contract)", () => {
  let app: INestApplication;
  const mockPrismaService = {
    ping: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/v1/health/live", () => {
    it("should return 200 OK with liveness contract payload", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/health/live")
        .expect(200);

      expect(res.body).toEqual({
        status: "ok",
        service: "datria-api",
        timestamp: expect.any(String),
      });
      expect(new Date(res.body.timestamp).toString()).not.toBe("Invalid Date");
    });
  });

  describe("GET /api/v1/health/ready", () => {
    it("should return 200 OK with database up when database ping succeeds", async () => {
      mockPrismaService.ping.mockResolvedValueOnce(true);

      const res = await request(app.getHttpServer())
        .get("/api/v1/health/ready")
        .expect(200);

      expect(res.body).toEqual({
        status: "ok",
        service: "datria-api",
        timestamp: expect.any(String),
        checks: {
          database: "up",
        },
      });
    });

    it("should return 503 Service Unavailable when database ping fails", async () => {
      mockPrismaService.ping.mockResolvedValueOnce(false);

      const res = await request(app.getHttpServer())
        .get("/api/v1/health/ready")
        .expect(503);

      expect(res.body).toEqual({
        status: "unavailable",
        service: "datria-api",
        timestamp: expect.any(String),
        checks: {
          database: "down",
        },
      });
    });
  });
});
