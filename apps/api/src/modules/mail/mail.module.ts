import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MAIL_PORT } from "./mail-port.interface";
import { NodemailerMailAdapter } from "./nodemailer-mail.adapter";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MAIL_PORT,
      useClass: NodemailerMailAdapter,
    },
    NodemailerMailAdapter,
  ],
  exports: [MAIL_PORT, NodemailerMailAdapter],
})
export class MailModule {}
