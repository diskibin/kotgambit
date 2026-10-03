export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired';

export interface SubscriptionState {
  status: SubscriptionStatus;
  /** The end of the period that is paid for. */
  currentPeriodEnd: Date;
  /** The saved payment method is charged again when the period ends. */
  autoRenew: boolean;
}

export type SubscriptionEvent =
  /** A payment went through: the first one or a renewal, `periodEnd` is the end of the period it paid for. */
  | { type: 'payment-succeeded'; periodEnd: Date }
  /** The charge for the next period was refused. */
  | { type: 'renewal-failed' }
  /** The learner cancelled: nothing more is charged, the paid period stays. */
  | { type: 'cancel' }
  /** The learner took the cancellation back before the paid period ended. */
  | { type: 'resume'; now: Date }
  /** Time has passed: the period may have ended. */
  | { type: 'tick'; now: Date };

const MS_IN_DAY = 24 * 60 * 60 * 1000;
// A failed renewal keeps the access for a few days, so that a card that needs a moment does not lock a learner out
export const GRACE_DAYS = 3;

/** The state after an event. A pure function: the transitions are tested without a database. */
export function transition(state: SubscriptionState, event: SubscriptionEvent): SubscriptionState {
  switch (event.type) {
    case 'payment-succeeded':
      return { status: 'active', currentPeriodEnd: event.periodEnd, autoRenew: state.autoRenew };

    case 'renewal-failed':
      return state.status === 'active' ? { ...state, status: 'past_due' } : state;

    case 'cancel':
      if (state.status === 'active' || state.status === 'past_due') {
        return { ...state, status: 'canceled', autoRenew: false };
      }
      return { ...state, autoRenew: false };

    case 'resume':
      return state.status === 'canceled' && event.now < state.currentPeriodEnd
        ? { ...state, status: 'active', autoRenew: true }
        : state;

    case 'tick': {
      if (state.status === 'expired' || event.now < state.currentPeriodEnd) return state;
      if (state.status === 'canceled') return { ...state, status: 'expired' };
      if (state.status === 'active') {
        // Past the end with a card on file the renewal is on its way, without one there is nothing to wait for
        return state.autoRenew ? { ...state, status: 'past_due' } : { ...state, status: 'expired' };
      }
      const graceEnd = new Date(state.currentPeriodEnd.getTime() + GRACE_DAYS * MS_IN_DAY);
      return event.now >= graceEnd ? { ...state, status: 'expired' } : state;
    }
  }
}

/** Whether the learner has Premium at this moment. */
export function hasPremium(state: SubscriptionState, now: Date): boolean {
  if (state.status === 'expired') return false;
  if (now < state.currentPeriodEnd) return true;
  if (state.status !== 'past_due') return false;
  return now < new Date(state.currentPeriodEnd.getTime() + GRACE_DAYS * MS_IN_DAY);
}
