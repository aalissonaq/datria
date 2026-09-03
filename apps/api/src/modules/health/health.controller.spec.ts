import { Test, TestingModule } from "@nestjs/testing";
import { HttpException, HttpStatus } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthController", () => {
  let controller: HealthController;
  let healthService: HealthService;

  const mockHealthService = {
    getLiveness: jest.fn(),
    getReadiness: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthService>(HealthService);
    jest.clearAllMocks();
  });

  describe("getLiveness", () => {
    it("should return ok status and service identifier conforming to OpenAPI contract", () => {
      const mockLiveness = {
        status: "ok" as const,
        service: "datria-api" as const,
        timestamp: new Date().toISOString(),
      };
      mockHealthService.getLiveness.mockReturnValue(mockLiveness);

      const result = controller.getLiveness();

      expect(result.status).toBe("ok");
      expect(result.service).toBe("datria-api");
      expect(result.timestamp).toBeDefined();
      expect(healthService.getLiveness).toHaveBeenCalledTimes(1);
    });
  });

  describe("getReadiness", () => {
    it("should return ok status and database up when database check passes", async () => {
      const mockReadiness = {
        status: "ok" as const,
        service: "datria-api" as const,
        timestamp: new Date().toISOString(),
        checks: {
          database: "up" as const,
        },
      };
      mockHealthService.getReadiness.mockResolvedValue(mockReadiness);

      const result = await controller.getReadiness();

      expect(result.status).toBe("ok");
      expect(result.checks.database).toBe("up");
    });

    it("should throw 503 HttpException with unavailable status when database check fails", async () => {
      const mockUnavailable = {
        status: "unavailable" as const,
        service: "datria-api" as const,
        timestamp: new Date().toISOString(),
        checks: {
          database: "down" as const,
        },
      };
      mockHealthService.getReadiness.mockRejectedValue(
        new HttpException(mockUnavailable, HttpStatus.SERVICE_UNAVAILABLE),
      );

      await expect(controller.getReadiness()).rejects.toThrow(HttpException);
    });
  });
});
