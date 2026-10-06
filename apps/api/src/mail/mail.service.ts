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

  /** Only for a learner who switched reminders on. Every letter carries the way out. */
  sendReminder(
    to: string,
    options: { name: string | null; goalMinutes: number; learnUrl: string; unsubscribeUrl: string },
  ): Promise<void> {
    return this.transport.send({
      to,
      subject: 'Гамбит ждёт тебя',
      text: [
        options.name ? `Привет, ${options.name}! Это Гамбит.` : 'Привет! Это Гамбит.',
        `Ты давно не заглядывал. Выдели ${options.goalMinutes} минут: одна глава или пара задач — и снова в ритме.`,
        options.learnUrl,
        `Ты получаешь это письмо, потому что сам включил напоминания в настройках. Отписаться можно одним нажатием: ${options.unsubscribeUrl}`,
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
