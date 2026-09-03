import { PrismaClient, RoleScope } from "@prisma/client";

const prisma = new PrismaClient();

export interface StaticRoleDefinition {
  code: string;
  scope: RoleScope;
  description: string;
}

export const STATIC_ROLES: StaticRoleDefinition[] = [
  {
    code: "INSTITUTION_ADMIN",
    scope: RoleScope.ORGANIZATION,
    description:
      "Administrador institucional com autoridade sobre membros, convites e configurações",
  },
  {
    code: "TEACHER",
    scope: RoleScope.ORGANIZATION,
    description:
      "Professor com autoridade para autoria e gestão de turmas e avaliações",
  },
  {
    code: "REVIEWER",
    scope: RoleScope.ORGANIZATION,
    description:
      "Revisor responsável pela revisão e aprovação de itens e avaliações",
  },
  {
    code: "PARTICIPANT",
    scope: RoleScope.ORGANIZATION,
    description:
      "Participante habilitado para realização de avaliações e atividades",
  },
  {
    code: "SAAS_ADMIN",
    scope: RoleScope.PLATFORM,
    description: "Administrador global da plataforma SaaS",
  },
];

export async function seedRoles(): Promise<void> {
  for (const role of STATIC_ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        scope: role.scope,
        description: role.description,
      },
      create: {
        code: role.code,
        scope: role.scope,
        description: role.description,
      },
    });
  }
}

async function main() {
  await seedRoles();
  // eslint-disable-next-line no-console
  console.log("Successfully seeded static roles.");
}

if (require.main === module) {
  main()
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
