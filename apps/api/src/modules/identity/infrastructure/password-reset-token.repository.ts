import { Injectable } from "@nestjs/common";
import { PasswordResetToken } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

export interface CreateResetTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createToken(data: CreateResetTokenData): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findValidToken(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
        consumedAt: null,
        revokedAt: null,
      },
    });
  }

  async markAsConsumed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  async revokeActiveTokensForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId,
        consumedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }
}
