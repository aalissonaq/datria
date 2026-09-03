import { Injectable } from "@nestjs/common";
import {
  ConsentRecord,
  EmailVerificationToken,
  User,
  UserStatus,
} from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

export interface CreateUserWithCredentialsData {
  displayName: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  termsVersion: string;
}

export interface CreateVerificationTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { normalizedEmail },
    });
  }

  async findByNormalizedEmailWithCredentials(normalizedEmail: string) {
    return this.prisma.user.findUnique({
      where: { normalizedEmail },
      include: {
        passwordCredential: true,
      },
    });
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.prisma.passwordCredential.update({
      where: { userId },
      data: { passwordHash },
    });
  }

  async createUserWithCredentials(
    data: CreateUserWithCredentialsData,
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          displayName: data.displayName,
          email: data.email,
          normalizedEmail: data.normalizedEmail,
          status: UserStatus.PENDING_VERIFICATION,
        },
      });

      await tx.passwordCredential.create({
        data: {
          userId: user.id,
          passwordHash: data.passwordHash,
        },
      });

      await tx.consentRecord.create({
        data: {
          userId: user.id,
          documentType: "TERMS_OF_SERVICE",
          documentVersion: data.termsVersion,
          acceptedAt: new Date(),
        },
      });

      return user;
    });
  }

  async createVerificationToken(
    data: CreateVerificationTokenData,
  ): Promise<EmailVerificationToken> {
    return this.prisma.emailVerificationToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findVerificationTokenByHash(
    tokenHash: string,
  ): Promise<(EmailVerificationToken & { user: User }) | null> {
    return this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async consumeVerificationTokenAndActivateUser(
    tokenId: string,
    userId: string,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: tokenId },
        data: { consumedAt: now },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.ACTIVE,
          emailVerifiedAt: now,
        },
      });
    });
  }

  async invalidatePendingVerificationTokens(userId: string): Promise<void> {
    const now = new Date();
    await this.prisma.emailVerificationToken.updateMany({
      where: {
        userId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        expiresAt: now, // Expire immediately
      },
    });
  }

  async findConsentRecordsByUser(userId: string): Promise<ConsentRecord[]> {
    return this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { acceptedAt: "desc" },
    });
  }
}
