export interface PasswordResetTemplateParams {
  displayName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export function buildPasswordResetEmail(params: PasswordResetTemplateParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Recuperação de Senha - Datria";

  const text = `Olá, ${params.displayName}!\n\nRecebemos uma solicitação para redefinir a senha da sua conta na plataforma Datria.\n\nPara cadastrar uma nova senha, acesse o link abaixo (válido por ${params.expiresInMinutes} minutos):\n${params.resetUrl}\n\nSe você não solicitou a redefinição de senha, ignore este e-mail com segurança. Sua senha atual permanecerá inalterada.\n\nAtenciosamente,\nEquipe Datria`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .card { background-color: #1e293b; border-radius: 12px; max-width: 540px; margin: 0 auto; padding: 32px; border: 1px solid #334155; }
    .btn { display: inline-block; background-color: #38bdf8; color: #0f172a; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0; }
    .footer { font-size: 13px; color: #94a3b8; margin-top: 24px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Recuperação de Senha</h2>
    <p>Olá, <strong>${params.displayName}</strong>!</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta na plataforma Datria.</p>
    <p>Clique no botão abaixo para cadastrar uma nova senha (link válido por ${params.expiresInMinutes} minutos):</p>
    <p><a href="${params.resetUrl}" class="btn">Redefinir Minha Senha</a></p>
    <p class="footer">Se o botão não funcionar, copie e cole este link no seu navegador:<br><a href="${params.resetUrl}" style="color: #38bdf8;">${params.resetUrl}</a></p>
    <p class="footer">Se você não realizou esta solicitação, desconsidere esta mensagem. Sua conta permanece segura.</p>
  </div>
</body>
</html>`;

  return { subject, html, text };
}
