import { boardReducer, createBoardState, type BoardOptions } from '@kotgambit/board-controller';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useReducer } from 'react';
import '../../shared/i18n';
import { Board } from './Board';

const PROMOTION_FEN = '8/4P2k/8/8/8/8/8/K7 w - - 0 1';

function Harness({ options }: { options?: BoardOptions }) {
  const [state, dispatch] = useReducer(boardReducer, createBoardState(options));
  return <Board state={state} dispatch={dispatch} />;
}

describe('Board', () => {
  it('labels squares for screen readers', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Белый конь g1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Пустая клетка f3')).toBeOnTheScreen();
  });

  it('plays a move by pressing the piece and then the target', () => {
    render(<Harness />);
    fireEvent.press(screen.getByLabelText('Белая пешка e2'));
    expect(screen.getByLabelText('Белая пешка e2, выбрана')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Пустая клетка e4, возможный ход'));
    expect(screen.getByLabelText('Белая пешка e4')).toBeOnTheScreen();
    expect(screen.getByLabelText('Пустая клетка e2')).toBeOnTheScreen();
  });

  it('asks for the promotion piece and completes the move', () => {
    render(<Harness options={{ fen: PROMOTION_FEN }} />);
    fireEvent.press(screen.getByLabelText('Белая пешка e7'));
    fireEvent.press(screen.getByLabelText('Пустая клетка e8, возможный ход'));
    expect(screen.getByLabelText('Ферзь')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Конь'));
    expect(screen.getByLabelText('Белый конь e8')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Ферзь')).toBeNull();
  });

  it('cancels the promotion by pressing the dimmed board', () => {
    render(<Harness options={{ fen: PROMOTION_FEN }} />);
    fireEvent.press(screen.getByLabelText('Белая пешка e7'));
    fireEvent.press(screen.getByLabelText('Пустая клетка e8, возможный ход'));
    fireEvent.press(screen.getByRole('button', { name: 'Превращение пешки' }));
    expect(screen.queryByLabelText('Ферзь')).toBeNull();
    expect(screen.getByLabelText('Белая пешка e7')).toBeOnTheScreen();
  });

  it('ignores presses when disabled', () => {
    const dispatch = jest.fn();
    render(<Board state={createBoardState()} dispatch={dispatch} disabled />);
    fireEvent.press(screen.getByLabelText('Белая пешка e2'));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
