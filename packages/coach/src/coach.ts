import { PHRASES, type PhraseKey } from './phrases.js';
import {
  HINT_OFFER_ATTEMPTS,
  STREAK_NOTICE,
  type CoachEvent,
  type CoachMessage,
  type Phrase,
} from './types.js';

// Below this share of first-try answers a lesson was a rough ride, and the cat celebrates more softly
const GOOD_ACCURACY = 0.6;

export interface Coach {
  message(event: CoachEvent): CoachMessage;
}

/**
 * `random` is injected so that tests are deterministic. The cat remembers the last line it used
 * for every situation and never says the same one twice in a row.
 */
export function createCoach(random: () => number = Math.random): Coach {
  const last = new Map<PhraseKey, number>();

  function pick(key: PhraseKey): Phrase {
    const variants: readonly Phrase[] = PHRASES[key];
    const previous = last.get(key);
    const pool = variants.map((_, index) => index).filter((index) => index !== previous);
    const index = pool[Math.floor(random() * pool.length)] ?? 0;
    last.set(key, index);
    return variants[index] as Phrase;
  }

  return {
    message(event) {
      switch (event.type) {
        case 'STEP_CORRECT': {
          const streak = event.streak >= STREAK_NOTICE && event.attempts === 1;
          const phrase = pick(streak ? 'streak' : 'correct');
          return {
            title: phrase.title,
            text: event.detail ?? phrase.text,
            mascot: streak ? 'proud' : 'happy',
            tone: 'success',
            effect: 'none',
          };
        }
        case 'STEP_WRONG': {
          const phrase = pick('wrong');
          // After a couple of misses the cat offers help instead of just asking to try again
          const offer = event.attempts >= HINT_OFFER_ATTEMPTS ? pick('offerHint') : null;
          return {
            title: phrase.title,
            text: [event.detail ?? phrase.text, offer?.text].filter(Boolean).join(' '),
            mascot: 'oops',
            tone: 'oops',
            effect: 'shake',
          };
        }
        case 'HINT': {
          const phrase = pick('hint');
          return {
            title: phrase.title,
            text: event.detail ?? phrase.text,
            mascot: 'hint',
            tone: 'hint',
            effect: 'none',
          };
        }
        case 'DEMO': {
          const phrase = pick('demo');
          return {
            title: phrase.title,
            text: event.detail ?? phrase.text,
            mascot: 'hint',
            tone: 'demo',
            effect: 'none',
          };
        }
        case 'LESSON_COMPLETED': {
          const soft = event.accuracy < GOOD_ACCURACY;
          const phrase = pick(soft ? 'soft' : 'celebrate');
          return {
            title: phrase.title,
            text: phrase.text,
            mascot: soft ? 'happy' : 'cheer',
            tone: soft ? 'soft' : 'celebrate',
            effect: 'confetti',
          };
        }
      }
    },
  };
}
