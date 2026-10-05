import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/renderApp';
import { legalContact } from './legalContact';

describe('the offer', () => {
  it('opens for a visitor who is not signed in and numbers its parts', async () => {
    renderApp('/offer');
    expect(
      await screen.findByRole('heading', { name: 'Публичная оферта', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Редакция от 5 октября 2026 года')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Общие положения' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '6. Автопродление и отмена подписки' }),
    ).toBeInTheDocument();
  });

  it('says how the subscription is cancelled and that the renewal is on by consent only', async () => {
    renderApp('/offer');
    expect(
      await screen.findByText(/Автоматическое продление включается только с согласия Пользователя/),
    ).toBeInTheDocument();
    expect(screen.getByText(/кнопкой «Отменить подписку»/)).toBeInTheDocument();
  });

  it('shows plain gaps where the details of the operator are not set, never an empty place', async () => {
    renderApp('/offer');
    await screen.findByRole('heading', { name: 'Публичная оферта', level: 1 });
    expect(screen.getAllByText(/\[не указано: VITE_LEGAL_OPERATOR/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\[не указано: VITE_LEGAL_EMAIL\]/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/{{/)).not.toBeInTheDocument();
  });

  it('links to the privacy policy and back to the main page', async () => {
    renderApp('/offer');
    await screen.findByRole('heading', { name: 'Публичная оферта', level: 1 });
    const nav = screen.getAllByRole('navigation').at(-1) as HTMLElement;
    expect(within(nav).getByRole('link', { name: 'Политика конфиденциальности' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(within(nav).getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/');
  });
});

describe('the privacy policy', () => {
  it('names the data, the payment service and the way to delete the account', async () => {
    renderApp('/privacy');
    expect(
      await screen.findByRole('heading', { name: 'Политика конфиденциальности', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Номер карты, срок действия и код нам не передаются/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Аккаунт можно удалить самому в настройках/)).toBeInTheDocument();
  });

  it('has the parts that the links of the site point to: the cookies and the contacts', async () => {
    renderApp('/privacy');
    await screen.findByRole('heading', { name: 'Политика конфиденциальности', level: 1 });
    expect(document.getElementById('cookies')).toHaveTextContent('Cookie и хранилище устройства');
    expect(document.getElementById('contacts')).toHaveTextContent('Контакты оператора');
  });
});

describe('legalContact', () => {
  it('takes the details from the settings of the build', () => {
    expect(
      legalContact({
        VITE_LEGAL_OPERATOR: 'ИП Иванов И. И.',
        VITE_LEGAL_DETAILS: 'ИНН 000000000000',
        VITE_LEGAL_EMAIL: 'help@example.com',
      }),
    ).toEqual({
      operator: 'ИП Иванов И. И.',
      details: 'ИНН 000000000000',
      email: 'help@example.com',
    });
  });
});
