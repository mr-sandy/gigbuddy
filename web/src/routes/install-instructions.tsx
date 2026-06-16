/*
 * Hard install gate for iPhone Safari (Story 2.2, AR-22, UX-DR8, NFR-25).
 *
 * Rendered by app-bootstrap when isIPhone() && !isStandalone(). The surface
 * has no dismiss / skip — installation is a precondition for Wake Lock and
 * full-screen privileges on iPhone (NFR-25), and for navigator.storage
 * persistence (AR-21, consumed by Story 2.4's outbox).
 *
 * The Performance atmosphere is already on <html> at boot time for iPhone
 * (applyBootAtmosphere in main.tsx); this component reads tokens via CSS
 * variables and does not need to flip the atmosphere itself.
 */
export function InstallInstructions() {
  return (
    <main
      aria-labelledby="install-heading"
      className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col justify-center px-[var(--spacing-gutter)]"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), var(--spacing-section-gap))',
        paddingBottom: 'max(env(safe-area-inset-bottom), var(--spacing-section-gap))',
      }}
    >
      <h1
        id="install-heading"
        className="text-[length:var(--text-perf-title)] leading-[var(--text-perf-title--line-height)] text-[color:var(--color-text-primary)]"
      >
        Install GigBuddy
      </h1>
      <p className="mt-[var(--spacing-card-stack-gap)] text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] text-[color:var(--color-text-secondary)]">
        GigBuddy runs on iPhone as a home-screen app.
      </p>
      <ol className="mt-[var(--spacing-section-gap)] flex list-decimal flex-col gap-[var(--spacing-card-stack-gap)] pl-[calc(var(--spacing-unit)*6)] text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] text-[color:var(--color-text-primary)]">
        <li>Tap the Share button at the bottom of Safari.</li>
        <li>Scroll and tap &ldquo;Add to Home Screen&rdquo;.</li>
        <li>Tap Add. Then open GigBuddy from your home screen.</li>
      </ol>
    </main>
  );
}
