import { createTransport, type Transporter } from 'nodemailer';
import type { MailMessage, MailTransport } from './mail.transport.js';

export class SmtpMailTransport implements MailTransport {
  constructor(
    private readonly from: string,
    private readonly transporter: Transporter,
  ) {}

  static fromUrl(smtpUrl: string, from: string): SmtpMailTransport {
    return new SmtpMailTransport(from, createTransport(smtpUrl));
  }

  async send({ to, subject, text }: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }
}
