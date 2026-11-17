import 'sileo/styles.css';
import { Toaster } from 'sileo';
import { useTheme } from '@/shared/ui/theme';

/** Toasts (DESIGN.md §Componentes): siguen la clase .dark de <html> y usan la superficie del tema. */
export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="top-center"
      theme={theme}
      options={{ fill: 'var(--color-surface)', duration: 4000 }}
    />
  );
}
