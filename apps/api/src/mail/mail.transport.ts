export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** What the app needs from a mail provider, so that the provider can be swapped and faked in tests. */
export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
