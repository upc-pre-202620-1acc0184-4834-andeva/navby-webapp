import 'sileo/styles.css';
import { Toaster } from 'sileo';
import { useTheme } from '@/shared/ui/theme';

/** Alto del TopBar (h-14): los toasts aparecen debajo de él, no encima de sus botones. */
const TOPBAR_HEIGHT_PX = 56;

/** Toasts (DESIGN.md §Componentes): siguen la clase .dark de <html> y usan la superficie del tema. */
export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="top-center"
      offset={{ top: TOPBAR_HEIGHT_PX }}
      theme={theme}
      options={{
        fill: 'var(--color-surface)',
        duration: 4000,
        roundness: 14,
        // sileo capitaliza el título y tiñe la descripción para un relleno oscuro: se alinean al tema.
        styles: { title: 'normal-case!', description: 'text-fg-muted!' },
      }}
    />
  );
}
