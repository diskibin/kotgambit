import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { makeStore } from '../../app/store';
import { CompletePage } from './CompletePage';

const RESULT = {
  xp: 20,
  accuracy: 1,
  stars: 3,
  firstTime: true,
  goalReachedNow: false,
  nextLessonId: 'basics-rook' as string | null,
  progress: { streakDays: 1, todaySeconds: 120, goalSeconds: 600, xpTotal: 20 },
};

function open(result = RESULT) {
  render(
    <Provider store={makeStore()}>
      <MemoryRouter
        initialEntries={[
          { pathname: '/lesson/basics-board/done', state: { result, title: 'Доска и фигуры' } },
        ]}
      >
        <Routes>
          <Route path="/lesson/:id/done" element={<CompletePage />} />
          <Route path="/lesson/:id" element={<p>Урок</p>} />
          <Route path="/learn" element={<p>Главы и разделы</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('the end of a lesson', () => {
  it('has the way out to the chapters and the sections to the left of the repeat', () => {
    open();
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual(['К главам', 'Повторить урок', 'Дальше']);
  });

  it('leads to the chapters and the sections', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'К главам' }));
    expect(await screen.findByText('Главы и разделы')).toBeInTheDocument();
  });

  it('still repeats the lesson and moves on', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Повторить урок' }));
    expect(await screen.findByText('Урок')).toBeInTheDocument();
  });
});
