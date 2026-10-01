import type { MailMessage, MailTransport } from '../src/mail/mail.transport.js';

/** Collects the emails a test run would have sent. */
export class MemoryMailTransport implements MailTransport {
  readonly outbox: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
    return Promise.resolve();
  }

  clear(): void {
    this.outbox.length = 0;
  }

  /** The one-time token from the link in the latest message to an address. */
  latestToken(to: string): string | undefined {
    const message = [...this.outbox].reverse().find((m) => m.to === to);
    return /token=([^\s]+)/.exec(message?.text ?? '')?.[1];
  }
}
