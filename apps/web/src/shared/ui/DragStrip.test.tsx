import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DragStrip } from './DragStrip';

function setup() {
  const onOpen = vi.fn();
  render(
    <DragStrip className="overflow-x-auto">
      <button type="button" onClick={onOpen}>
        Открыть
      </button>
    </DragStrip>,
  );
  const button = screen.getByRole('button', { name: 'Открыть' });
  const strip = button.parentElement as HTMLElement;
  strip.scrollLeft = 100;
  return { button, strip, onOpen };
}

describe('DragStrip', () => {
  it('scrolls the row opposite to the mouse while it is held and moved', () => {
    const { button, strip } = setup();
    fireEvent.mouseDown(button, { button: 0, clientX: 300 });
    fireEvent.mouseMove(window, { clientX: 240 });
    expect(strip.scrollLeft).toBe(160);
    fireEvent.mouseMove(window, { clientX: 330 });
    expect(strip.scrollLeft).toBe(70);
    fireEvent.mouseUp(window);
    fireEvent.mouseMove(window, { clientX: 0 });
    expect(strip.scrollLeft).toBe(70);
  });

  it('does not open the card whose button the drag ended on', () => {
    const { button, onOpen } = setup();
    fireEvent.mouseDown(button, { button: 0, clientX: 300 });
    fireEvent.mouseMove(window, { clientX: 200 });
    fireEvent.mouseUp(window);
    fireEvent.click(button);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('still lets a plain click, or a tiny shake, through', () => {
    const { button, strip, onOpen } = setup();
    fireEvent.mouseDown(button, { button: 0, clientX: 300 });
    fireEvent.mouseMove(window, { clientX: 297 });
    fireEvent.mouseUp(window);
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(strip.scrollLeft).toBe(100);
  });

  it('ignores the other buttons of the mouse', () => {
    const { button, strip } = setup();
    fireEvent.mouseDown(button, { button: 2, clientX: 300 });
    fireEvent.mouseMove(window, { clientX: 200 });
    expect(strip.scrollLeft).toBe(100);
  });
});
