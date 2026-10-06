import { describe, expect, it } from 'vitest';
import { AnalyticsEventRequestSchema, StatsQuerySchema } from './analytics.js';

const ID = '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11';

describe('analytics contracts', () => {
  it('takes a known step with an id, and nothing else', () => {
    expect(AnalyticsEventRequestSchema.safeParse({ visitorId: ID, name: 'visit' }).success).toBe(
      true,
    );
    expect(AnalyticsEventRequestSchema.safeParse({ visitorId: ID, name: 'paid' }).success).toBe(
      false,
    );
    expect(
      AnalyticsEventRequestSchema.safeParse({ visitorId: 'someone@example.com', name: 'visit' })
        .success,
    ).toBe(false);
  });

  it('wants the kind of hint with the events about hints, and with them only', () => {
    const parse = (event: object) =>
      AnalyticsEventRequestSchema.safeParse({ visitorId: ID, ...event }).success;
    expect(parse({ name: 'nudge_view', detail: 'puzzles-soft' })).toBe(true);
    expect(parse({ name: 'nudge_click', detail: 'cards-limit' })).toBe(true);
    expect(parse({ name: 'nudge_view' })).toBe(false);
    expect(parse({ name: 'visit', detail: 'puzzles-soft' })).toBe(false);
    expect(parse({ name: 'nudge_view', detail: 'free text about a person' })).toBe(false);
  });

  it('reads the period from a query string and falls back to 30 days', () => {
    expect(StatsQuerySchema.parse('7')).toBe(7);
    expect(StatsQuerySchema.parse(undefined)).toBe(30);
    expect(StatsQuerySchema.safeParse('15').success).toBe(false);
  });
});
