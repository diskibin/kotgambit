import {
  CARD_PHRASES,
  CARD_TITLES,
  GAME_PHRASES,
  GAME_TITLES,
  PHRASES,
  PUZZLE_PHRASES,
  PUZZLE_TITLES,
  puzzleHintTitle,
  type CardPhraseKey,
  type GamePhraseKey,
  type PhraseKey,
  type PuzzlePhraseKey,
} from './phrases.js';
import {
  HINT_OFFER_ATTEMPTS,
  STREAK_NOTICE,
  type CoachEvent,
  type CoachMessage,
  type GameEndReason,
  type GameOutcome,
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
  const lastGameText = new Map<GamePhraseKey, number>();
  const lastCardText = new Map<CardPhraseKey, number>();

  function pick(key: PhraseKey): Phrase {
    const variants: readonly Phrase[] = PHRASES[key];
    const previous = last.get(key);
    const pool = variants.map((_, index) => index).filter((index) => index !== previous);
    const index = pool[Math.floor(random() * pool.length)] ?? 0;
    last.set(key, index);
    return variants[index] as Phrase;
  }

  const lastText = new Map<PuzzlePhraseKey, number>();

  /** The puzzle card has fixed headings, so only its text is picked, again never the same twice in a row. */
  function pickText(key: PuzzlePhraseKey): string {
    const variants: readonly string[] = PUZZLE_PHRASES[key];
    const previous = lastText.get(key);
    const pool = variants.map((_, index) => index).filter((index) => index !== previous);
    const index = pool[Math.floor(random() * pool.length)] ?? 0;
    lastText.set(key, index);
    return variants[index] as string;
  }

  function pickGameText(key: GamePhraseKey): string {
    const variants: readonly string[] = GAME_PHRASES[key];
    const previous = lastGameText.get(key);
    const pool = variants.map((_, index) => index).filter((index) => index !== previous);
    const index = pool[Math.floor(random() * pool.length)] ?? 0;
    lastGameText.set(key, index);
    return variants[index] as string;
  }

  function game(
    title: string,
    key: GamePhraseKey,
    look: Pick<CoachMessage, 'mascot' | 'tone' | 'effect'>,
    suffix = '',
  ): CoachMessage {
    return { title, text: `${pickGameText(key)}${suffix}`, ...look };
  }

  function card(
    title: string,
    key: CardPhraseKey,
    look: Pick<CoachMessage, 'mascot' | 'tone' | 'effect'>,
  ): CoachMessage {
    const variants: readonly string[] = CARD_PHRASES[key];
    const previous = lastCardText.get(key);
    const pool = variants.map((_, index) => index).filter((index) => index !== previous);
    const index = pool[Math.floor(random() * pool.length)] ?? 0;
    lastCardText.set(key, index);
    return { title, text: variants[index] as string, ...look };
  }

  function gameOver(
    outcome: GameOutcome,
    reason: GameEndReason,
    bot: { name: string; gender: 'f' | 'm' } | undefined,
  ): CoachMessage {
    if (outcome === 'win') {
      return game(GAME_TITLES.win, 'win', {
        mascot: 'cheer',
        tone: 'celebrate',
        effect: 'confetti',
      });
    }
    if (outcome === 'loss') {
      const key = reason === 'resignation' ? 'resigned' : 'loss';
      const title =
        key === 'loss' && bot
          ? `${bot.gender === 'f' ? 'Победила' : 'Победил'} ${bot.name}`
          : GAME_TITLES.over;
      return game(title, key, { mascot: 'oops', tone: 'soft', effect: 'none' });
    }
    const stalemate = reason === 'stalemate';
    return game(
      stalemate ? GAME_TITLES.stalemate : GAME_TITLES.draw,
      stalemate ? 'stalemate' : 'draw',
      { mascot: 'thinking', tone: 'neutral', effect: 'none' },
    );
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
        case 'PUZZLE_START':
          return {
            title: PUZZLE_TITLES.solving,
            text: pickText('solving'),
            mascot: 'thinking',
            tone: 'neutral',
            effect: 'none',
          };
        case 'PUZZLE_SOLVED': {
          const streak = event.streak >= STREAK_NOTICE;
          return {
            title: PUZZLE_TITLES.correct,
            text: pickText(streak ? 'streak' : 'correct'),
            mascot: streak ? 'proud' : 'happy',
            tone: 'success',
            effect: 'none',
          };
        }
        case 'PUZZLE_WRONG':
          return {
            title: PUZZLE_TITLES.wrong,
            text: pickText('wrong'),
            mascot: 'oops',
            tone: 'oops',
            effect: 'none',
          };
        case 'PUZZLE_HINT': {
          const named = event.level === 2 && event.themes && event.themes.length > 0;
          const key: PuzzlePhraseKey =
            event.level === 1
              ? 'hint1'
              : event.level === 3
                ? 'hint3'
                : named
                  ? 'hint2'
                  : 'hint2Plain';
          // The themes follow the sentence, so that "these tricks" has something to point at
          const text = named ? `${pickText(key)} ${event.themes?.join(', ')}.` : pickText(key);
          return {
            title: puzzleHintTitle(event.level),
            text,
            mascot: 'hint',
            tone: 'hint',
            effect: 'none',
          };
        }
        case 'PUZZLE_SOLUTION':
          return {
            title: PUZZLE_TITLES.solution,
            text: pickText('solution'),
            mascot: 'hint',
            tone: 'demo',
            effect: 'none',
          };
        case 'GAME_START':
          return game(GAME_TITLES.start, 'start', {
            mascot: 'idle',
            tone: 'neutral',
            effect: 'none',
          });
        case 'GAME_MOVE':
          return game(GAME_TITLES.move, 'move', {
            mascot: 'idle',
            tone: 'neutral',
            effect: 'none',
          });
        case 'GAME_CHECK':
          return game(GAME_TITLES.check, 'check', { mascot: 'hint', tone: 'hint', effect: 'none' });
        case 'GAME_PROMOTION':
          return game(GAME_TITLES.promotion, 'promotion', {
            mascot: 'happy',
            tone: 'success',
            effect: 'none',
          });
        case 'GAME_HINT':
          return game(
            GAME_TITLES.hint,
            'hint',
            { mascot: 'hint', tone: 'hint', effect: 'none' },
            ` Ход: ${event.san}.`,
          );
        case 'GAME_UNDO':
          return game(GAME_TITLES.undo, 'undo', { mascot: 'idle', tone: 'soft', effect: 'none' });
        case 'GAME_RESIGN_ASK':
          return game(GAME_TITLES.resign, 'resign', {
            mascot: 'oops',
            tone: 'soft',
            effect: 'none',
          });
        case 'GAME_BUSY':
          return game(GAME_TITLES.busy, 'busy', {
            mascot: 'thinking',
            tone: 'soft',
            effect: 'none',
          });
        case 'CARD_START':
          return card(CARD_TITLES.start, 'start', {
            mascot: 'thinking',
            tone: 'neutral',
            effect: 'none',
          });
        case 'CARD_CORRECT':
          return card(CARD_TITLES.correct, 'correct', {
            mascot: 'happy',
            tone: 'success',
            effect: 'none',
          });
        case 'CARD_WRONG':
          return card(CARD_TITLES.wrong, 'wrong', { mascot: 'hint', tone: 'soft', effect: 'none' });
        case 'CARD_EMPTY':
          return card(CARD_TITLES.empty, 'empty', {
            mascot: 'proud',
            tone: 'success',
            effect: 'none',
          });
        case 'GAME_OVER':
          return gameOver(event.outcome, event.reason, event.bot);
      }
    },
  };
}
