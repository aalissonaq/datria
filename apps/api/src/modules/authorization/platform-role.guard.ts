import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import {
  ForbiddenException,
  UnauthorizedException,
} from "../../common/exceptions/domain.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "./tenant-context.interface";

@Injectable()
export class PlatformRoleGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new UnauthorizedException(
        "Authentication required for platform operations",
      );
    }

    const platformAssignment =
      await this.prisma.platformRoleAssignment.findFirst({
        where: {
          userId: user.id,
          revokedAt: null,
          role: {
            code: "SAAS_ADMIN",
          },
        },
        include: {
          role: true,
        },
      });

    if (!platformAssignment) {
      throw new ForbiddenException(
        "Access denied: Platform Administrator privileges required",
      );
    }

    return true;
  }
}
