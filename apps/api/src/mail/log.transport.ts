import { Logger } from '@nestjs/common';
import type { MailMessage, MailTransport } from './mail.transport.js';

/**
 * Development stand-in: the whole message, with its link, goes to the log.
 * Production refuses to start without SMTP_URL, because a log must never hold working links.
 */
export class LogMailTransport implements MailTransport {
  private readonly logger = new Logger('Mail');

  send(message: MailMessage): Promise<void> {
    this.logger.log(`To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`);
    return Promise.resolve();
  }
}
