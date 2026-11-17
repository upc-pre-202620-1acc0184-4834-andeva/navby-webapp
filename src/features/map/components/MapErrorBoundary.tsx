import { Component, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';
import { StatusMessage } from '@/shared/ui/StatusMessage';

interface MapErrorBoundaryOwnProps {
  children: ReactNode;
  fallbackLegend?: ReactNode;
  onError?: () => void;
}

type MapErrorBoundaryProps = MapErrorBoundaryOwnProps & WithTranslation;

interface MapErrorBoundaryState {
  hasError: boolean;
}

/**
 * Aísla fallos de carga lazy o inicialización WebGL del mapa y ofrece la leyenda textual
 * sin derribar el formulario de búsqueda ni el resto de la página.
 */
class MapErrorBoundaryBase extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  state: MapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError?.();
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { t, fallbackLegend } = this.props;
      return (
        <div className="flex h-full w-full flex-col justify-center gap-4 bg-surface-sunken p-4 lg:pl-[460px]">
          <StatusMessage
            variant="info"
            title={t('map.fallbackTitle')}
            description={t('map.fallbackDescription')}
          />
          {fallbackLegend}
        </div>
      );
    }

    return this.props.children;
  }
}

export const MapErrorBoundary = withTranslation()(MapErrorBoundaryBase);
