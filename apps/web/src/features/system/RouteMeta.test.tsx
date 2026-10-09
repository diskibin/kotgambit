import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RouteMeta } from './RouteMeta';

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RouteMeta />
    </MemoryRouter>,
  );
const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content');

describe('RouteMeta', () => {
  it('lets search engines in on the home page and the documents', () => {
    at('/');
    expect(document.title).toMatch(/^Кот Гамбит — шахматы для начинающих/);
    expect(robots()).toBe('index, follow');
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://kotgambit.ru/',
    );

    at('/offer');
    expect(document.title).toBe('Оферта — Кот Гамбит');
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://kotgambit.ru/offer',
    );
  });

  it('keeps the pages of the learner and unknown addresses out of search', () => {
    at('/lesson/basics-knight');
    expect(document.title).toBe('Урок — Кот Гамбит');
    expect(robots()).toBe('noindex, nofollow');

    at('/no/such/page');
    expect(document.title).toBe('Страница не найдена — Кот Гамбит');
    expect(robots()).toBe('noindex, nofollow');
  });
});
