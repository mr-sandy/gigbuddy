import { ACTIVE_BAND_NAME } from '@gigbuddy/shared';
import { Check, ChevronDown, Download } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { SETTINGS } from '../lib/microcopy.js';
import { readThemeChoice, saveThemeChoice, type ThemeChoice } from '../lib/theme.js';
import { Button } from './ui/button.js';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from './ui/sheet.js';

const SECTION_HEADING =
  'm-0 text-[length:var(--text-small)] font-normal leading-[var(--text-small--line-height)] text-muted-foreground';
const SECTION_GAP = 'mt-[var(--spacing-section-gap)]';

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: SETTINGS.system },
  { value: 'light', label: SETTINGS.light },
  { value: 'dark', label: SETTINGS.dark },
];

function AppearanceControl({ headingId }: { headingId: string }) {
  const [choice, setChoice] = useState<ThemeChoice>(readThemeChoice);
  return (
    <fieldset
      aria-labelledby={headingId}
      className="m-0 mt-2 grid min-w-0 grid-cols-3 overflow-hidden rounded-lg border border-input p-0"
    >
      {CHOICES.map(({ value, label }, i) => (
        <Button
          key={value}
          type="button"
          variant={choice === value ? 'default' : 'ghost'}
          aria-pressed={choice === value}
          className={i > 0 ? 'rounded-none border-l border-input' : 'rounded-none'}
          onClick={() => {
            saveThemeChoice(value);
            setChoice(value);
          }}
        >
          {label}
        </Button>
      ))}
    </fieldset>
  );
}

/* Mounts with the sheet, so the stored choice is read each time it opens. */
function SettingsBody() {
  const appearanceId = useId();
  return (
    <SheetBody>
      <h2 className={`${SECTION_HEADING} mt-[calc(var(--spacing-unit)*2)]`}>{SETTINGS.band}</h2>
      <div
        aria-current="true"
        className="flex min-h-tap items-center justify-between gap-3 border-b border-border text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-foreground"
      >
        <span>{ACTIVE_BAND_NAME}</span>
        <Check aria-hidden="true" className="size-6 shrink-0 text-primary" />
      </div>

      <h2 id={appearanceId} className={`${SECTION_HEADING} ${SECTION_GAP}`}>
        {SETTINGS.appearance}
      </h2>
      <AppearanceControl headingId={appearanceId} />

      <h2 className={`${SECTION_HEADING} ${SECTION_GAP}`}>{SETTINGS.yourData}</h2>
      {/* Plain <a>, not Link: the router would swallow the click and the download would never fire. */}
      <Button asChild variant="link" className="mt-1">
        <a href="/api/v1/export">
          <Download aria-hidden="true" />
          {SETTINGS.exportLink}
        </a>
      </Button>
      <p className="m-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground">
        {SETTINGS.exportHelp}
      </p>
    </SheetBody>
  );
}

/*
 * The band name on the list pages (Story 7.22): a button that opens the
 * settings sheet. The sheet is a menu, not an editing task, so it has no
 * route; Done and Escape close it.
 */
export function BandMenu() {
  const [open, setOpen] = useState(false);
  const bandButton = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        ref={bandButton}
        type="button"
        variant="ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="text-[length:var(--text-nav)] leading-[var(--text-nav--line-height)] text-foreground [font-family:var(--font-serif-editorial)]"
        onClick={() => setOpen(true)}
      >
        {ACTIVE_BAND_NAME}
        <ChevronDown aria-hidden="true" className="text-primary" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          aria-describedby={undefined}
          onCloseAutoFocus={() => bandButton.current?.focus()}
        >
          <SheetHeader>
            <span aria-hidden="true" />
            <SheetTitle>{SETTINGS.title}</SheetTitle>
            <Button
              type="button"
              variant="ghost"
              className="text-primary"
              onClick={() => setOpen(false)}
            >
              {SETTINGS.done}
            </Button>
          </SheetHeader>
          <SettingsBody />
        </SheetContent>
      </Sheet>
    </>
  );
}
