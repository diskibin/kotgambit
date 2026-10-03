import type { PositionProblem } from '@kotgambit/chess-core';

type Side = 'w' | 'b';

const SIDE_NAMES: Record<Side, string> = { w: 'Белый', b: 'Чёрный' };

/** What the learner is told when a position cannot be analysed, with what to do about it. */
export function describePositionProblem(problem: PositionProblem): string {
  switch (problem.kind) {
    case 'no-king': {
      const side = problem.color === 'w' ? 'белых' : 'чёрных';
      const example = problem.color === 'w' ? 'e1' : 'e8';
      return `У ${side} нет короля. Поставь ${problem.color === 'w' ? 'белого' : 'чёрного'} короля, например на ${example}, и анализ заработает.`;
    }
    case 'many-kings':
      return `${SIDE_NAMES[problem.color]} король может быть только один. Убери лишнего.`;
    case 'pawn-on-edge':
      return `Пешка на ${problem.square} стоит на первой или последней горизонтали. Пешки там не бывает, убери её или передвинь.`;
    case 'kings-touch':
      return 'Короли не могут стоять рядом. Отодвинь один из них.';
    case 'too-many-pieces':
      return `У ${problem.color === 'w' ? 'белых' : 'чёрных'} слишком много фигур или пешек. Убери лишние.`;
    case 'side-not-to-move-in-check':
      return 'Король стороны, которая не ходит, под шахом. Так не бывает: смени очередь хода или передвинь фигуры.';
    case 'malformed':
      return 'Не получилось прочитать позицию. Проверь FEN: ряды, чей ход и фигуры.';
    case 'illegal':
      return 'Такая позиция невозможна. Проверь рокировки и взятие на проходе.';
  }
}
