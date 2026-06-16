import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstallInstructions } from './install-instructions.js';

describe('InstallInstructions', () => {
  it('renders the install heading and the three steps', () => {
    render(<InstallInstructions />);
    expect(screen.getByRole('heading', { level: 1, name: 'Install GigBuddy' })).toBeInTheDocument();
    expect(screen.getByText('GigBuddy runs on iPhone as a home-screen app.')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Tap the Share button at the bottom of Safari.');
    expect(items[1]).toHaveTextContent('Add to Home Screen');
    expect(items[2]).toHaveTextContent('Tap Add. Then open GigBuddy from your home screen.');
  });

  it('exposes no interactive controls (the gate is hard — no skip / dismiss)', () => {
    render(<InstallInstructions />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('contains no voice-and-tone-violating copy (no exclamation marks, no emoji)', () => {
    render(<InstallInstructions />);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/!/);
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
