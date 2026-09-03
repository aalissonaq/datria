import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const url = configService.get<string>("DATABASE_URL");
    super(url ? { datasources: { db: { url } } } : undefined);
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("Prisma client connected to database.");
    } catch {
      this.logger.warn("Prisma client initial connection deferred or failed.");
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Prisma client disconnected.");
  }

  /**
   * Performs a bounded, parameter-free connectivity query to check MySQL readiness.
   * Enforces a timeout to prevent hanging connections.
   * @param timeoutMs Maximum milliseconds to wait for the query (default 3000ms)
   */
  async ping(timeoutMs = 3000): Promise<boolean> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      const pingPromise = this.$queryRaw`SELECT 1`;
      const timeoutPromise = new Promise<never>(
        (_, reject) =>
          (timeoutHandle = setTimeout(
            () => reject(new Error("Database query timed out")),
            timeoutMs,
          )),
      );

      await Promise.race([pingPromise, timeoutPromise]);
      return true;
    } catch {
      this.logger.warn("Database ping check failed.");
      return false;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}
