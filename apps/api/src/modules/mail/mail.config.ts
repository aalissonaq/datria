import { ConfigService } from "@nestjs/config";
import type { TransportOptions } from "nodemailer";
import { EnvironmentVariables } from "../../config/env.validation";

export interface MailerConfiguration {
  transport: TransportOptions;
  defaults: {
    from: string;
  };
  uiUrl: string;
}

export function createMailerConfig(
  configService: ConfigService<EnvironmentVariables, true>,
): MailerConfiguration {
  const host = configService.get("SMTP_HOST", { infer: true });
  const port = configService.get("SMTP_PORT", { infer: true });
  const from = configService.get("SMTP_FROM", { infer: true });
  const uiUrl = configService.get("MAILPIT_UI_URL", { infer: true });

  const transport: TransportOptions = {
    host,
    port,
    secure: false,
    ignoreTLS: true,
  } as TransportOptions;

  return {
    transport,
    defaults: {
      from,
    },
    uiUrl,
  };
}
