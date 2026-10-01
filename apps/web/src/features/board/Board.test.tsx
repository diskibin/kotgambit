import { boardReducer, createBoardState, type BoardOptions } from '@kotgambit/board-controller';
import { fireEvent, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { vi } from 'vitest';
import { Board } from './Board';

const PROMOTION_FEN = '8/4P2k/8/8/8/8/8/K7 w - - 0 1';
const CHECK_FEN = 'rnbqkbnr/ppp2ppp/8/1B1pp3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3';

function Harness({ options, flip }: { options?: BoardOptions; flip?: boolean }) {
  const [state, dispatch] = useReducer(boardReducer, createBoardState(options));
  return (
    <>
      <Board state={state} dispatch={dispatch} />
      {flip && <button onClick={() => dispatch({ type: 'orientation/flip' })}>flip</button>}
    </>
  );
}

const square = (name: string) => screen.getByRole('button', { name: new RegExp(` ${name}(,|$)`) });

describe('Board', () => {
  it('draws all 64 squares with the dark a1 and light h1', () => {
    render(<Harness />);
    expect(document.querySelectorAll('[data-square]')).toHaveLength(64);
    expect(document.querySelector('[data-square="a1"]')).toHaveClass('bg-board-a');
    expect(document.querySelector('[data-square="h1"]')).toHaveClass('bg-board-b');
  });

  it('labels squares for screen readers', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Белый конь g1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Пустая клетка f3' })).toBeInTheDocument();
  });

  it('puts white at the bottom and flips on request', () => {
    render(<Harness flip />);
    const order = () =>
      [...document.querySelectorAll('[data-square]')].map((el) => el.getAttribute('data-square'));
    expect(order()[0]).toBe('a8');
    expect(order()[63]).toBe('h1');
    fireEvent.click(screen.getByText('flip'));
    expect(order()[0]).toBe('h1');
    expect(order()[63]).toBe('a8');
  });

  it('plays a move by clicking the piece and then the target', () => {
    render(<Harness />);
    fireEvent.click(square('e2'));
    expect(screen.getByRole('button', { name: 'Белая пешка e2, выбрана' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Пустая клетка e4, возможный ход' }),
    ).toBeInTheDocument();
    fireEvent.click(square('e4'));
    expect(screen.getByRole('button', { name: 'Белая пешка e4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Пустая клетка e2' })).toBeInTheDocument();
  });

  it('marks the last move and the king in check', () => {
    render(<Harness options={{ fen: CHECK_FEN }} />);
    expect(document.querySelectorAll('.board-check')).toHaveLength(1);
    expect(document.querySelector('[data-square="e8"] .board-check')).not.toBeNull();
    fireEvent.click(square('e2'));
    expect(document.querySelectorAll('.board-last')).toHaveLength(0);
  });

  it('asks for the promotion piece and completes the move', () => {
    render(<Harness options={{ fen: PROMOTION_FEN }} />);
    fireEvent.click(square('e7'));
    fireEvent.click(square('e8'));
    expect(screen.getByRole('group', { name: 'Превращение пешки' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ферзь' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Конь' }));
    expect(screen.getByRole('button', { name: 'Белый конь e8' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Превращение пешки' })).toBeNull();
  });

  it('cancels the promotion with Escape', () => {
    render(<Harness options={{ fen: PROMOTION_FEN }} />);
    fireEvent.click(square('e7'));
    fireEvent.click(square('e8'));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Ферзь' }), { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Превращение пешки' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Белая пешка e7' })).toBeInTheDocument();
  });

  it('moves focus with the arrow keys following the orientation', () => {
    render(<Harness flip />);
    square('a8').focus();
    fireEvent.keyDown(square('a8'), { key: 'ArrowRight' });
    expect(square('b8')).toHaveFocus();
    fireEvent.keyDown(square('b8'), { key: 'ArrowDown' });
    expect(square('b7')).toHaveFocus();
    fireEvent.click(screen.getByText('flip'));
    square('b7').focus();
    fireEvent.keyDown(square('b7'), { key: 'ArrowRight' });
    expect(square('a7')).toHaveFocus();
  });

  it('clears the selection with Escape', () => {
    render(<Harness />);
    fireEvent.click(square('e2'));
    fireEvent.keyDown(square('e2'), { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Белая пешка e2' })).toBeInTheDocument();
  });

  it('plays a move by dragging a piece', () => {
    render(<Harness />);
    const board = screen.getByRole('group', { name: 'Шахматная доска' });
    board.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 800, right: 800, bottom: 800 }) as DOMRect;
    // e2 is column 4, row 6 of an 8x8 board drawn from white's side; e4 is row 4
    fireEvent.pointerDown(square('e2'), { button: 0, clientX: 450, clientY: 650, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 450, clientY: 550, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 450, clientY: 450, pointerId: 1 });
    expect(screen.getByRole('button', { name: 'Белая пешка e4' })).toBeInTheDocument();
  });

  it('treats a small movement as a click, not a drag', () => {
    render(<Harness />);
    const board = screen.getByRole('group', { name: 'Шахматная доска' });
    board.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 800, right: 800, bottom: 800 }) as DOMRect;
    fireEvent.pointerDown(square('e2'), { button: 0, clientX: 450, clientY: 650, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 451, clientY: 651, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 451, clientY: 651, pointerId: 1 });
    fireEvent.click(square('e2'));
    expect(screen.getByRole('button', { name: 'Белая пешка e2, выбрана' })).toBeInTheDocument();
  });

  it('shows hint squares', () => {
    const state = createBoardState();
    render(<Board state={state} dispatch={() => {}} hintSquares={['g1']} />);
    expect(document.querySelector('[data-square="g1"] .board-hint')).not.toBeNull();
  });
});

describe('Board in lesson mode', () => {
  it('draws arrows between the given squares', () => {
    render(
      <Board
        state={createBoardState()}
        dispatch={() => {}}
        arrows={[{ from: 'g1', to: 'f3', color: 'sun' }]}
      />,
    );
    expect(document.querySelector('[data-arrow="g1f3"]')).not.toBeNull();
  });

  it('reports presses instead of moving pieces when asked to', () => {
    const onSquarePress = vi.fn();
    const dispatch = vi.fn();
    render(
      <Board
        state={createBoardState()}
        dispatch={dispatch}
        onSquarePress={onSquarePress}
        marked={['e4']}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Белая пешка e2' }));
    expect(onSquarePress).toHaveBeenCalledWith('e2');
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Пустая клетка e4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(document.querySelector('[data-square="e4"] .board-selected')).not.toBeNull();
  });

  it('shows the last move it is told about', () => {
    render(
      <Board state={createBoardState()} dispatch={() => {}} lastMove={{ from: 'e2', to: 'e4' }} />,
    );
    expect(document.querySelectorAll('.board-last')).toHaveLength(2);
  });
});
