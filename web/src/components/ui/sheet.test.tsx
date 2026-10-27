import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from './sheet.js';

function renderSheet(onOpenChange = vi.fn()) {
  render(
    <>
      <p>Page behind</p>
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <button type="button">Cancel</button>
            <SheetTitle>Edit song</SheetTitle>
            <button type="button">Save</button>
          </SheetHeader>
          <SheetBody>
            <input aria-label="Title" />
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>,
  );
  return onOpenChange;
}

describe('Sheet', () => {
  it('is a dialog named by its title', () => {
    renderSheet();
    expect(screen.getByRole('dialog', { name: 'Edit song' })).toBeInTheDocument();
  });

  it('asks to close on Escape', async () => {
    const onOpenChange = renderSheet();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not close when the dimmed page is tapped', async () => {
    const onOpenChange = renderSheet();
    const overlay = document.querySelector('[data-slot="sheet-overlay"]') as HTMLElement;
    await userEvent.pointer([{ keys: '[MouseLeft]', target: overlay }]);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('slides in when it opens (Story 7.24)', () => {
    renderSheet();
    const content = document.querySelector('[data-slot="sheet-content"]') as HTMLElement;
    const overlay = document.querySelector('[data-slot="sheet-overlay"]') as HTMLElement;
    expect(content.classList).toContain('data-[state=open]:animate-sheet-up');
    expect(content.classList).toContain('md:data-[state=open]:animate-sheet-in');
    expect(overlay.classList).toContain('data-[state=open]:animate-scrim-in');
  });
});
