import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, type InputProps } from '@/shared/ui/Input';

/** Contraseña con botón mostrar/ocultar; no bloquea pegar ni el gestor de contraseñas (WCAG 3.3.8). */
export function PasswordInput(props: Omit<InputProps, 'type'>) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-12" />
      <button
        type="button"
        aria-label={t('auth.showPassword')}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-lg text-fg-muted transition-colors duration-150 ease-(--ease-out) hover:text-fg"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
