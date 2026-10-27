import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button.js';

describe('Button', () => {
  it('renders a default-variant button', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('data-variant', 'default');
    expect(button).toHaveClass('bg-primary');
  });

  it('renders the child element with asChild', () => {
    render(
      <Button asChild variant="link">
        <a href="/api/v1/export">Export</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Export' });
    expect(link).toHaveAttribute('href', '/api/v1/export');
    expect(link).toHaveAttribute('data-variant', 'link');
    expect(link).toHaveClass('underline');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders a small secondary button that keeps the 44px tap height', () => {
    render(
      <Button variant="secondary" size="sm">
        Edit setlist
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Edit setlist' });
    expect(button).toHaveAttribute('data-variant', 'secondary');
    expect(button).toHaveAttribute('data-size', 'sm');
    expect(button).toHaveClass('bg-muted', 'min-h-tap');
  });

  it('honours disabled', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
