import { Inject, Injectable } from "@nestjs/common";
import { AuditOutcome, InvitationStatus } from "@prisma/client";
import {
  ConflictException,
  InvalidTokenException,
  ResourceNotFoundException,
  ValidationErrorException,
} from "../../common/exceptions/domain.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { TokenService } from "../identity/infrastructure/token.service";
import { MAIL_PORT, MailPort } from "../mail/mail-port.interface";
import { buildInvitationEmail } from "../mail/templates/invitation.template";
import { FullInvitation, InvitationRepository } from "./invitation.repository";

export const ALLOWED_INSTITUTIONAL_ROLES = [
  "INSTITUTION_ADMIN",
  "TEACHER",
  "REVIEWER",
  "PARTICIPANT",
];

@Injectable()
export class InvitationService {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    @Inject(MAIL_PORT) private readonly mailPort: MailPort,
    private readonly auditService: AuditService,
  ) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async createInvitation(
    organizationId: string,
    email: string,
    roleCodes: string[],
    invitedByUserId: string,
    correlationId: string,
    webOrigin = "http://localhost:5173",
  ): Promise<{ invitation: FullInvitation; rawToken: string }> {
    const normalizedEmail = this.normalizeEmail(email);

    if (!roleCodes || roleCodes.length === 0) {
      throw new ValidationErrorException(
        "At least one institutional role is required",
      );
    }

    for (const code of roleCodes) {
      if (!ALLOWED_INSTITUTIONAL_ROLES.includes(code)) {
        throw new ValidationErrorException(
          `Role ${code} is not an approved institutional role`,
        );
      }
    }

    // Resolve roles
    const dbRoles = await this.prisma.role.findMany({
      where: { code: { in: roleCodes } },
    });

    if (dbRoles.length !== roleCodes.length) {
      throw new ValidationErrorException("One or more roles do not exist");
    }

    // Generate secure token
    const { rawToken, tokenHash } = this.tokenService.generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.invitationRepository.createInvitation({
      organizationId,
      email,
      normalizedEmail,
      tokenHash,
      expiresAt,
      invitedByUserId,
      roleIds: dbRoles.map((r) => r.id),
    });

    // Send email
    const inviteUrl = `${webOrigin}/accept-invitation?token=${rawToken}`;
    const emailContent = buildInvitationEmail({
      recipientEmail: email,
      organizationName: invitation.organization.name,
      roles: roleCodes,
      inviteUrl,
      expiresInDays: 7,
    });

    await this.mailPort.sendMail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    await this.auditService.logEvent({
      actorUserId: invitedByUserId,
      organizationId,
      action: "INVITATION_SENT",
      targetType: "Invitation",
      targetId: invitation.id,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        recipientEmail: normalizedEmail,
        roles: roleCodes,
      },
    });

    return { invitation, rawToken };
  }

  async resendInvitation(
    organizationId: string,
    invitationId: string,
    actorUserId: string,
    correlationId: string,
    webOrigin = "http://localhost:5173",
  ): Promise<void> {
    const invitation = await this.invitationRepository.findById(invitationId);

    if (!invitation || invitation.organizationId !== organizationId) {
      throw new ResourceNotFoundException("Invitation not found");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException(
        "Only pending invitations can be resent",
        "INVITATION_NOT_PENDING",
      );
    }

    const { rawToken, tokenHash } = this.tokenService.generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        tokenHash,
        expiresAt,
      },
    });

    const inviteUrl = `${webOrigin}/accept-invitation?token=${rawToken}`;
    const emailContent = buildInvitationEmail({
      recipientEmail: invitation.email,
      organizationName: invitation.organization.name,
      roles: invitation.roles.map((r) => r.role.code),
      inviteUrl,
      expiresInDays: 7,
    });

    await this.mailPort.sendMail({
      to: invitation.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    await this.auditService.logEvent({
      actorUserId,
      organizationId,
      action: "INVITATION_RESENT",
      targetType: "Invitation",
      targetId: invitation.id,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        recipientEmail: invitation.normalizedEmail,
      },
    });
  }

  async revokeInvitation(
    organizationId: string,
    invitationId: string,
    actorUserId: string,
    correlationId: string,
  ): Promise<void> {
    const invitation = await this.invitationRepository.findById(invitationId);

    if (!invitation || invitation.organizationId !== organizationId) {
      throw new ResourceNotFoundException("Invitation not found");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException(
        "Only pending invitations can be revoked",
        "INVITATION_NOT_PENDING",
      );
    }

    await this.invitationRepository.updateStatus(
      invitationId,
      InvitationStatus.REVOKED,
      { revokedAt: new Date() },
    );

    await this.auditService.logEvent({
      actorUserId,
      organizationId,
      action: "INVITATION_REVOKED",
      targetType: "Invitation",
      targetId: invitation.id,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        recipientEmail: invitation.normalizedEmail,
      },
    });
  }

  async acceptInvitation(
    rawToken: string,
    acceptingUserId: string,
    correlationId: string,
  ) {
    const tokenHash = this.tokenService.hashToken(rawToken);
    const invitation =
      await this.invitationRepository.findByTokenHash(tokenHash);

    if (
      !invitation ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt <= new Date()
    ) {
      throw new InvalidTokenException(
        "The invitation is invalid, expired, or has already been used",
      );
    }

    const organizationId = invitation.organizationId;

    const result = await this.prisma.$transaction(async (tx) => {
      // Find or create membership
      let membership = await tx.membership.findFirst({
        where: {
          organizationId,
          userId: acceptingUserId,
        },
      });

      if (!membership) {
        membership = await tx.membership.create({
          data: {
            organizationId,
            userId: acceptingUserId,
            status: "ACTIVE",
          },
        });
      } else if (membership.status !== "ACTIVE") {
        membership = await tx.membership.update({
          where: { id: membership.id },
          data: { status: "ACTIVE" },
        });
      }

      // Assign roles
      for (const roleRel of invitation.roles) {
        await tx.membershipRole.upsert({
          where: {
            membershipId_roleId: {
              membershipId: membership.id,
              roleId: roleRel.roleId,
            },
          },
          create: {
            membershipId: membership.id,
            roleId: roleRel.roleId,
            assignedByUserId: invitation.invitedByUserId,
          },
          update: {},
        });
      }

      // Mark invitation accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedByUserId: acceptingUserId,
        },
      });

      return {
        membership,
        organization: invitation.organization,
      };
    });

    await this.auditService.logEvent({
      actorUserId: acceptingUserId,
      organizationId,
      action: "INVITATION_ACCEPTED",
      targetType: "Invitation",
      targetId: invitation.id,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        organizationId,
        roles: invitation.roles.map((r) => r.role.code),
      },
    });

    return result;
  }
}
