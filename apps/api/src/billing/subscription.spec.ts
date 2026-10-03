import { describe, expect, it } from 'vitest';
import { addPlanPeriod } from './plans.js';
import {
  GRACE_DAYS,
  hasPremium,
  transition,
  type SubscriptionEvent,
  type SubscriptionState,
} from './subscription-machine.js';

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const END = day('2026-11-01');

const active: SubscriptionState = { status: 'active', currentPeriodEnd: END, autoRenew: true };
const run = (state: SubscriptionState, ...events: SubscriptionEvent[]) =>
  events.reduce(transition, state);

describe('transition', () => {
  it('activates on a payment and sets the end of the paid period', () => {
    const next = day('2026-12-01');
    const first = transition(
      { status: 'expired', currentPeriodEnd: day('2026-09-01'), autoRenew: false },
      { type: 'payment-succeeded', periodEnd: next },
    );
    expect(first).toEqual({ status: 'active', currentPeriodEnd: next, autoRenew: false });
  });

  it('is active again after a renewal that follows a failed one', () => {
    const state = run(active, { type: 'renewal-failed' });
    expect(state.status).toBe('past_due');
    const renewed = transition(state, { type: 'payment-succeeded', periodEnd: day('2026-12-01') });
    expect(renewed).toMatchObject({ status: 'active', autoRenew: true });
  });

  it('keeps nothing but the access when the learner cancels', () => {
    expect(run(active, { type: 'cancel' })).toEqual({
      status: 'canceled',
      currentPeriodEnd: END,
      autoRenew: false,
    });
  });

  it('turns the renewal off for an expired subscription without bringing it back', () => {
    const expired: SubscriptionState = { ...active, status: 'expired' };
    expect(run(expired, { type: 'cancel' })).toMatchObject({ status: 'expired', autoRenew: false });
  });

  it('takes a cancellation back only before the paid period ends', () => {
    const canceled = run(active, { type: 'cancel' });
    expect(transition(canceled, { type: 'resume', now: day('2026-10-20') })).toMatchObject({
      status: 'active',
      autoRenew: true,
    });
    expect(transition(canceled, { type: 'resume', now: day('2026-11-02') })).toBe(canceled);
  });

  it('does not change anything while the period lasts', () => {
    expect(transition(active, { type: 'tick', now: day('2026-10-31') })).toBe(active);
  });

  it('waits for the renewal after the end when a card is on file, and gives up after the grace days', () => {
    const waiting = transition(active, { type: 'tick', now: day('2026-11-02') });
    expect(waiting.status).toBe('past_due');
    expect(transition(waiting, { type: 'tick', now: day('2026-11-03') })).toBe(waiting);
    const lastDay = new Date(END.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
    expect(transition(waiting, { type: 'tick', now: lastDay }).status).toBe('expired');
  });

  it('expires at the end when nothing renews it', () => {
    const noRenewal: SubscriptionState = { ...active, autoRenew: false };
    expect(transition(noRenewal, { type: 'tick', now: day('2026-11-02') }).status).toBe('expired');
    const canceled = run(active, { type: 'cancel' });
    expect(transition(canceled, { type: 'tick', now: day('2026-11-02') }).status).toBe('expired');
  });

  it('never leaves the expired state on its own', () => {
    const expired: SubscriptionState = { ...active, status: 'expired' };
    expect(transition(expired, { type: 'tick', now: day('2027-01-01') })).toBe(expired);
    expect(transition(expired, { type: 'renewal-failed' })).toBe(expired);
  });
});

describe('hasPremium', () => {
  it('is on during the paid period, also after a cancellation', () => {
    expect(hasPremium(active, day('2026-10-15'))).toBe(true);
    expect(hasPremium(run(active, { type: 'cancel' }), day('2026-10-15'))).toBe(true);
  });

  it('is off after the period for an active, a canceled and an expired subscription', () => {
    expect(hasPremium(active, day('2026-11-02'))).toBe(false);
    expect(hasPremium(run(active, { type: 'cancel' }), day('2026-11-02'))).toBe(false);
    expect(hasPremium({ ...active, status: 'expired' }, day('2026-10-15'))).toBe(false);
  });

  it('keeps the access through the grace days of a failed renewal', () => {
    const late: SubscriptionState = { ...active, status: 'past_due' };
    expect(hasPremium(late, day('2026-11-03'))).toBe(true);
    expect(hasPremium(late, day('2026-11-05'))).toBe(false);
  });
});

describe('addPlanPeriod', () => {
  it('adds a month or a year on the same day', () => {
    expect(addPlanPeriod(day('2026-10-03'), 'month').toISOString()).toBe(
      '2026-11-03T12:00:00.000Z',
    );
    expect(addPlanPeriod(day('2026-10-03'), 'year').toISOString()).toBe('2027-10-03T12:00:00.000Z');
  });

  it('stops at the last day of a shorter month', () => {
    expect(addPlanPeriod(day('2026-01-31'), 'month').toISOString()).toBe(
      '2026-02-28T12:00:00.000Z',
    );
    expect(addPlanPeriod(day('2028-01-31'), 'month').toISOString()).toBe(
      '2028-02-29T12:00:00.000Z',
    );
    expect(addPlanPeriod(day('2028-02-29'), 'year').toISOString()).toBe('2029-02-28T12:00:00.000Z');
  });
});
