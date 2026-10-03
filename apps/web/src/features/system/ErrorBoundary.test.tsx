import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../shared/i18n';
import { ErrorBoundary } from './ErrorBoundary';

function Broken(): never {
  throw new Error('broken screen');
}

describe('the error boundary', () => {
  beforeEach(() => {
    // React logs a caught render error on purpose: it is the thing under test
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('says it in the voice of the cat and offers to try again', () => {
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Гамбит задумался' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Попробовать снова' })).toBeInTheDocument();
  });

  it('leaves a working screen alone', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
  });
});
