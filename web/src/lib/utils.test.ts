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
});
