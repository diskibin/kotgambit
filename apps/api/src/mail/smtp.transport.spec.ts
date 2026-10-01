import { createTransport } from 'nodemailer';
import { describe, expect, it } from 'vitest';
import { MailService } from './mail.service.js';
import { SmtpMailTransport } from './smtp.transport.js';

describe('SmtpMailTransport', () => {
  it('hands the message to nodemailer with the configured sender', async () => {
    // jsonTransport builds the message and returns it instead of opening a connection
    const transporter = createTransport({ jsonTransport: true });
    const sent: unknown[] = [];
    const original = transporter.sendMail.bind(transporter);
    transporter.sendMail = ((options: never) => {
      sent.push(options);
      return original(options);
    }) as typeof transporter.sendMail;

    await new SmtpMailTransport('Кот Гамбит <noreply@example.com>', transporter).send({
      to: 'cat@example.com',
      subject: 'Тема',
      text: 'Текст',
    });

    expect(sent).toEqual([
      {
        from: 'Кот Гамбит <noreply@example.com>',
        to: 'cat@example.com',
        subject: 'Тема',
        text: 'Текст',
      },
    ]);
  });
});

describe('MailService', () => {
  it('puts the link and the lifetime into the verification email', async () => {
    const outbox: { to: string; subject: string; text: string }[] = [];
    const mail = new MailService({ send: (m) => Promise.resolve(void outbox.push(m)) });
    await mail.sendVerification('cat@example.com', 'https://kg.example/verify?token=abc');
    expect(outbox[0]?.text).toContain('https://kg.example/verify?token=abc');
    expect(outbox[0]?.text).toContain('48 часов');
  });

  it('puts the link and the lifetime into the reset email', async () => {
    const outbox: { to: string; subject: string; text: string }[] = [];
    const mail = new MailService({ send: (m) => Promise.resolve(void outbox.push(m)) });
    await mail.sendPasswordReset('cat@example.com', 'https://kg.example/reset?token=abc');
    expect(outbox[0]?.text).toContain('https://kg.example/reset?token=abc');
    expect(outbox[0]?.text).toContain('24 часа');
  });
});
