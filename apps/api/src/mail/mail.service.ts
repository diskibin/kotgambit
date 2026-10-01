import { Inject, Injectable } from '@nestjs/common';
import { MAIL_TRANSPORT, type MailTransport } from './mail.transport.js';

// The texts are in the cat's voice: short, warm, no pressure
const VERIFY_HOURS = 48;
const RESET_HOURS = 24;

export const VERIFY_EMAIL_TTL_MS = VERIFY_HOURS * 60 * 60 * 1000;
export const RESET_PASSWORD_TTL_MS = RESET_HOURS * 60 * 60 * 1000;

@Injectable()
export class MailService {
  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  sendVerification(to: string, link: string): Promise<void> {
    return this.transport.send({
      to,
      subject: 'Подтверди почту в Кот Гамбите',
      text: [
        'Привет! Это Гамбит.',
        'Подтверди почту, чтобы прогресс не потерялся, даже если ты сменишь устройство:',
        link,
        `Ссылка действует ${VERIFY_HOURS} часов. Если ты не регистрировался, просто не обращай внимания на это письмо.`,
      ].join('\n\n'),
    });
  }

  sendPasswordReset(to: string, link: string): Promise<void> {
    return this.transport.send({
      to,
      subject: 'Новый пароль для Кот Гамбита',
      text: [
        'Привет! Это Гамбит.',
        'Ты просил ссылку, чтобы придумать новый пароль:',
        link,
        `Она действует ${RESET_HOURS} часа. Если это был не ты, ничего не делай, пароль останется прежним.`,
      ].join('\n\n'),
    });
  }
}
