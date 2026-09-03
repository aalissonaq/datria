import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { MailPort, SendMailOptions } from "./mail-port.interface";
import { createMailerConfig, MailerConfiguration } from "./mail.config";
import { EnvironmentVariables } from "../../config/env.validation";

@Injectable()
export class NodemailerMailAdapter implements MailPort {
  private readonly logger = new Logger(NodemailerMailAdapter.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly defaultFrom: string;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    const config: MailerConfiguration = createMailerConfig(this.configService);
    this.defaultFrom = config.defaults.from;
    this.transporter = nodemailer.createTransport(config.transport);
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const from = options.from || this.defaultFrom;

    try {
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(
        `Email successfully dispatched to ${options.to} with subject "${options.subject}"`,
      );
    } catch (error) {
      // Log sanitized failure message without raw tokens
      this.logger.error(
        `Failed to deliver email to ${options.to} [subject: "${options.subject}"]: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }
}
