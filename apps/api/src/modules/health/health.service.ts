import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface LivenessResponse {
  status: "ok";
  service: "datria-api";
  timestamp: string;
}

export interface ReadinessResponse {
  status: "ok";
  service: "datria-api";
  timestamp: string;
  checks: {
    database: "up";
  };
}

export interface UnavailableResponse {
  status: "unavailable";
  service: "datria-api";
  timestamp: string;
  checks: {
    database: "down";
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  getLiveness(): LivenessResponse {
    return {
      status: "ok",
      service: "datria-api",
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const isDbUp = await this.prisma.ping(3000);

    if (!isDbUp) {
      this.logger.warn(
        "Readiness check failed: database is down or unresponsive.",
      );
      const unavailablePayload: UnavailableResponse = {
        status: "unavailable",
        service: "datria-api",
        timestamp: new Date().toISOString(),
        checks: {
          database: "down",
        },
      };
      throw new HttpException(
        unavailablePayload,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: "ok",
      service: "datria-api",
      timestamp: new Date().toISOString(),
      checks: {
        database: "up",
      },
    };
  }
}
