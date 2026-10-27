import { afterEach, describe, expect, it } from 'vitest';
import { historyIndex } from './history-depth.js';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('historyIndex', () => {
  it('returns the idx React Router stored in history state', () => {
    window.history.replaceState({ idx: 3 }, '');
    expect(historyIndex()).toBe(3);
  });

  it.each([
    ['null state', null],
    ['a missing idx', {}],
    ['a non-number idx', { idx: '2' }],
    ['a negative idx', { idx: -1 }],
  ])('returns 0 for %s', (_name, state) => {
    window.history.replaceState(state, '');
    expect(historyIndex()).toBe(0);
  });
});
