import { describe, expect, it } from 'vitest';
import { cn } from './utils.js';

describe('cn', () => {
  it('joins classes and drops falsy ones', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('lets a later conflicting class win', () => {
    expect(cn('px-4', 'px-2.5')).toBe('px-2.5');
  });

  it('keeps a custom font size while swapping the colour', () => {
    const result = cn('text-[length:var(--text-body)] text-primary', 'text-muted-foreground');
    expect(result).toContain('text-[length:var(--text-body)]');
    expect(result).toContain('text-muted-foreground');
    expect(result).not.toContain('text-primary');
    expect(result.endsWith('text-muted-foreground')).toBe(true);
  });

  it('lets a custom spacing token replace another', () => {
    expect(cn('min-h-tap px-4', 'min-h-play-bar')).toBe('px-4 min-h-play-bar');
    expect(cn('min-h-tap', 'min-h-tab-bar')).toBe('min-h-tab-bar');
    expect(cn('min-h-tap', 'min-h-header')).toBe('min-h-header');
    expect(cn('w-full', 'md:w-sheet')).toBe('w-full md:w-sheet');
    expect(cn('w-96', 'w-sheet')).toBe('w-sheet');
  });
});
