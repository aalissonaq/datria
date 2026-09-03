export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface MailPort {
  sendMail(options: SendMailOptions): Promise<void>;
}

export const MAIL_PORT = Symbol("MAIL_PORT");
