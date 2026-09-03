import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "../authorization/authentication.guard";
import {
  HealthService,
  LivenessResponse,
  ReadinessResponse,
} from "./health.service";

@ApiTags("Health")
@Controller("health")
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("live")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm that the API process can serve requests" })
  @ApiResponse({
    status: 200,
    description: "API process is live",
  })
  getLiveness(): LivenessResponse {
    return this.healthService.getLiveness();
  }

  @Get("ready")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Confirm that the API and required dependencies are usable",
  })
  @ApiResponse({
    status: 200,
    description: "API is ready to serve application traffic",
  })
  @ApiResponse({
    status: 503,
    description: "At least one required dependency is unavailable",
  })
  async getReadiness(): Promise<ReadinessResponse> {
    return await this.healthService.getReadiness();
  }
}
