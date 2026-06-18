import type { JSX } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/*
 * Inline-edit primitive (UX-DR4, EXPERIENCE.md "Inline edit field"). No
 * edit-mode toggle, no save button, no spinner — the field is always
 * editable; saves are silent (FR-2). The route owns the debounce; this
 * component just commits on blur if the local buffer diverged from
 * `value`.
 *
 * Buffer sync: `value` is the canonical source. `useEffect` resets the
 * local buffer when `value` changes from outside (e.g. the stale-write
 * cache replacement in flusher.ts:160-164 reaches the route as a new
 * `value` prop). The reset fires even while focused — the typing-during-
 * stale-write window is acknowledged in AC-5; the banner makes the
 * situation legible and Sandy can re-type.
 *
 * Disabled mode: a `disabled` input keeps the same visual shell as the
 * editable state (no layout jump on toggle). `/songs/new` uses this to
 * lock the non-Title fields until Title commits (AC-7).
 *
 * Multiline mode: a `<textarea>` that grows to `scrollHeight` via
 * `useLayoutEffect`. No auto-resize library needed.
 */

type Props = {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  disabled?: boolean;
};

const BASE_FIELD_CLASS =
  'block w-full min-h-tap resize-none border-0 bg-transparent p-0 text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] text-[color:var(--color-text-primary)] [font-family:var(--font-serif-editorial)] placeholder:text-[color:var(--color-text-secondary)] focus:outline-none focus-visible:[box-shadow:inset_0_-1px_0_0_var(--color-accent)] disabled:cursor-default disabled:opacity-70';

export function InlineEditField({
  value,
  onCommit,
  ariaLabel,
  multiline = false,
  placeholder,
  className,
  inputClassName,
  autoFocus = false,
  disabled = false,
}: Props): JSX.Element {
  const [local, setLocal] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `local` is the resize trigger — its value changing means the textarea's scrollHeight changed; Biome can't see that it flows through DOM rather than the closure.
  useLayoutEffect(() => {
    if (!multiline) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [local, multiline]);

  const handleBlur = (): void => {
    if (local !== value) onCommit(local);
  };

  const editorClass = `${BASE_FIELD_CLASS}${inputClassName ? ` ${inputClassName}` : ''}`;
  const wrapperClass = className;

  const shared = {
    'aria-label': ariaLabel,
    disabled,
    placeholder,
    className: editorClass,
    onBlur: handleBlur,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setLocal(e.target.value),
    value: local,
    autoFocus,
  };

  if (multiline) {
    return (
      <div className={wrapperClass}>
        <textarea ref={textareaRef} rows={1} {...shared} />
      </div>
    );
  }
  return (
    <div className={wrapperClass}>
      <input type="text" {...shared} />
    </div>
  );
}
