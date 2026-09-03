export interface VerifyEmailTemplateParams {
  displayName: string;
  verificationUrl: string;
  expiresInHours: number;
}

export function renderVerifyEmailTemplate(params: VerifyEmailTemplateParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Datria - Confirmação de e-mail e ativação de conta";

  const text = `Olá, ${params.displayName}!

Obrigado por se cadastrar na plataforma Datria.

Para ativar sua conta, acesse o link de verificação abaixo:
${params.verificationUrl}

Este link expira em ${params.expiresInHours} horas.

Se você não solicitou este cadastro, pode desconsiderar este e-mail.
Equipe Datria`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 540px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; }
    .logo { font-size: 24px; font-weight: bold; color: #38bdf8; margin-bottom: 24px; }
    .heading { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #ffffff; }
    .content { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .footer { font-size: 13px; color: #64748b; margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Datria</div>
    <div class="heading">Confirme seu endereço de e-mail</div>
    <div class="content">
      Olá <strong>${params.displayName}</strong>,<br><br>
      Obrigado por se cadastrar na Datria. Clique no botão abaixo para ativar sua conta:
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${params.verificationUrl}" class="btn" target="_blank">Confirmar E-mail</a>
    </div>
    <div class="content" style="font-size: 13px; color: #94a3b8;">
      Ou copie e cole este link no seu navegador:<br>
      <a href="${params.verificationUrl}" style="color: #38bdf8; word-break: break-all;">${params.verificationUrl}</a><br><br>
      Este link expira em ${params.expiresInHours} horas.
    </div>
    <div class="footer">
      Se você não criou uma conta na Datria, pode desconsiderar esta mensagem com segurança.
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
}
