export interface InvitationEmailOptions {
  recipientEmail: string;
  organizationName: string;
  roles: string[];
  inviteUrl: string;
  expiresInDays?: number;
}

export function buildInvitationEmail(options: InvitationEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Convite para participar da ${options.organizationName} na Datria`;
  const rolesList = options.roles.join(", ");
  const days = options.expiresInDays || 7;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f8fafc; padding: 24px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 32px;">
    <h1 style="color: #38bdf8; font-size: 24px; margin-top: 0;">Convite de Membro</h1>
    <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">
      Você foi convidado para fazer parte da organização <strong>${options.organizationName}</strong> na plataforma Datria como <strong>${rolesList}</strong>.
    </p>
    <div style="margin: 32px 0; text-align: center;">
      <a href="${options.inviteUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
        Aceitar Convite
      </a>
    </div>
    <p style="font-size: 14px; color: #94a3b8; line-height: 1.5;">
      Este convite é válido por ${days} dias. Se você não esperava por este convite, ignore esta mensagem.
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Convite para a organização ${options.organizationName}

Você foi convidado para participar da organização ${options.organizationName} como ${rolesList}.

Acesse o link abaixo para aceitar o convite (válido por ${days} dias):
${options.inviteUrl}

Se você não esperava por este convite, ignore esta mensagem.
  `.trim();

  return { subject, html, text };
}
