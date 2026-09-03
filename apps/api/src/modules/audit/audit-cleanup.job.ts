import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuditCleanupJob {
  private readonly logger = new Logger(AuditCleanupJob.name);

  constructor(private readonly prisma: PrismaService) {}

  async cleanupExpiredEvents(
    cutoffDate = new Date(),
  ): Promise<{ deletedCount: number }> {
    this.logger.log(
      `Iniciando expurgo de registros de auditoria expirados (corte: ${cutoffDate.toISOString()})`,
    );

    const result = await this.prisma.auditEvent.deleteMany({
      where: {
        expiresAt: {
          lte: cutoffDate,
        },
      },
    });

    this.logger.log(
      `Expurgo concluído com sucesso: ${result.count} registros removidos.`,
    );

    return {
      deletedCount: result.count,
    };
  }
}
