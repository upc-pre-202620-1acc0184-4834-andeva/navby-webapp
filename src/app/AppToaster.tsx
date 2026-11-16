import 'sileo/styles.css';
import { useSyncExternalStore } from 'react';
import { Toaster } from 'sileo';

type Theme = 'light' | 'dark';

const readTheme = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ['class'] });
  return () => observer.disconnect();
}

/** Toasts (DESIGN.md §Componentes): siguen la clase .dark de <html> y usan la superficie del tema. */
export function AppToaster() {
  const theme = useSyncExternalStore(subscribe, readTheme, (): Theme => 'light');

  return (
    <Toaster
      position="top-center"
      theme={theme}
      options={{ fill: 'var(--color-surface)', duration: 4000 }}
    />
  );
}
