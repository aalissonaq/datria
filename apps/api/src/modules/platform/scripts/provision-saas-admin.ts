import { PrismaClient, UserStatus } from "@prisma/client";

export async function provisionSaasAdmin(
  email: string,
  prismaClient?: any,
): Promise<{ assignmentId: string; userId: string }> {
  const prisma = prismaClient || new PrismaClient();
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { normalizedEmail },
  });

  if (!user) {
    throw new Error(`User with email "${normalizedEmail}" not found`);
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new Error(`User with email "${normalizedEmail}" is not ACTIVE`);
  }

  const saasAdminRole = await prisma.role.findUnique({
    where: { code: "SAAS_ADMIN" },
  });

  if (!saasAdminRole) {
    throw new Error(`Role "SAAS_ADMIN" not found in database`);
  }

  const assignment = await prisma.platformRoleAssignment.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: saasAdminRole.id,
      },
    },
    create: {
      userId: user.id,
      roleId: saasAdminRole.id,
      revokedAt: null,
    },
    update: {
      revokedAt: null,
    },
  });

  return {
    assignmentId: assignment.id,
    userId: user.id,
  };
}

// CLI Execution entry point
if (require.main === module) {
  const emailArg = process.argv[2];
  if (!emailArg) {
    console.error(
      "Uso: pnpm ts-node apps/api/src/modules/platform/scripts/provision-saas-admin.ts <email>",
    );
    process.exit(1);
  }

  provisionSaasAdmin(emailArg)
    .then(({ assignmentId, userId }) => {
      console.log(
        `[OK] Papel SAAS_ADMIN provisionado com sucesso para ${emailArg} (User ID: ${userId}, Assignment: ${assignmentId})`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[ERRO] Falha ao provisionar SAAS_ADMIN:`, err.message);
      process.exit(1);
    });
}
