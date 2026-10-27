import { createContext, type FormEvent, type ReactNode, useCallback, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from './ui/button.js';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet.js';

/*
 * Shared shell for the add / edit sheets (Story 7.21): Cancel · title · Save
 * in the header, a scrolling body below. The route is the state — the sheet is
 * always open while mounted, and closing is navigating. The form wraps header
 * and body so the header's Save is a real submit.
 */

export function useSheetExit(exitTo: string) {
  const navigate = useNavigate();
  const location = useLocation();
  // 'default' means the sheet's URL is the first page in the history stack.
  const hasHistory = location.key !== 'default';
  const leave = useCallback(() => {
    if (hasHistory) navigate(-1);
    else navigate(exitTo, { replace: true });
  }, [hasHistory, navigate, exitTo]);
  return { leave, hasHistory };
}

const FramedContext = createContext(false);

/*
 * The open sheet itself. An edit route wraps its loading state and the form
 * that replaces it in one frame, so the dialog isn't rebuilt when the record
 * arrives and focus still goes back to the opener on close. An `EditSheet`
 * inside a frame renders only its form.
 */
export function SheetFrame({
  onCancel,
  described,
  children,
}: {
  onCancel: () => void;
  described: boolean;
  children: ReactNode;
}) {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <SheetContent {...(described ? {} : { 'aria-describedby': undefined })}>
        <FramedContext.Provider value={true}>{children}</FramedContext.Provider>
      </SheetContent>
    </Sheet>
  );
}

export function EditSheet({
  title,
  cancelLabel,
  submitLabel,
  submitDisabled,
  onCancel,
  onSubmit,
  description,
  children,
}: {
  title: string;
  cancelLabel: string;
  submitLabel: string;
  submitDisabled: boolean;
  onCancel: () => void;
  onSubmit?: (event: FormEvent) => void;
  description?: ReactNode;
  children: ReactNode;
}) {
  const framed = useContext(FramedContext);
  const form = (
    <form
      onSubmit={onSubmit ?? ((event) => event.preventDefault())}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <SheetHeader>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <SheetTitle>{title}</SheetTitle>
        <Button type="submit" disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </SheetHeader>
      <SheetBody>
        {description === undefined ? null : <SheetDescription>{description}</SheetDescription>}
        {children}
      </SheetBody>
    </form>
  );
  if (framed) return form;
  return (
    <SheetFrame onCancel={onCancel} described={description !== undefined}>
      {form}
    </SheetFrame>
  );
}
