import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Itinerary } from '@/shared/api/schemas';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { type DeleteResult, useDeleteItinerary } from '../hooks/useItineraries';

export interface DeleteItineraryDialogProps {
  /** El itinerario a eliminar; `null` mantiene el diálogo cerrado. */
  itinerary: Itinerary | null;
  /** `204` o `404`: ya no existe (US-24); quien llama cierra el diálogo. */
  onDeleted: (itinerary: Itinerary, result: DeleteResult) => void;
  onClose: () => void;
}

/** Confirmación de eliminar (US-24): espera la respuesta del servidor, sin borrado optimista. */
export function DeleteItineraryDialog({
  itinerary,
  onDeleted,
  onClose,
}: DeleteItineraryDialogProps) {
  const { t } = useTranslation();
  const deletion = useDeleteItinerary();
  // El texto se conserva durante la salida animada, cuando `itinerary` ya es null.
  const [shown, setShown] = useState(itinerary);
  if (itinerary && itinerary !== shown) setShown(itinerary);

  const close = () => {
    deletion.reset();
    onClose();
  };

  return (
    <ConfirmDialog
      open={itinerary !== null}
      title={t('itineraries.dialog.title')}
      description={
        <>
          <p className="font-medium text-fg">{shown?.name}</p>
          <p>{t('itineraries.dialog.description')}</p>
        </>
      }
      confirmLabel={t('itineraries.dialog.confirm')}
      cancelLabel={t('itineraries.dialog.cancel')}
      pending={deletion.isPending}
      error={deletion.isError ? t('itineraries.dialog.error') : null}
      onConfirm={() => {
        if (!itinerary) return;
        deletion.mutate(itinerary.id, {
          onSuccess: (result) => {
            deletion.reset();
            onDeleted(itinerary, result);
          },
        });
      }}
      onClose={close}
    />
  );
}
