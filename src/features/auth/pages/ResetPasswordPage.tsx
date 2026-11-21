import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { resetPassword } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { isApiError } from '@/shared/api/errors';
import { Button } from '@/shared/ui/Button';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { Field } from '@/shared/ui/Field';
import { type ResetPasswordValues, resetPasswordSchema } from '../authSchemas';
import { AUTH_LINK_CLASS, FormNotice } from '../components/AuthCard';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordChecklist } from '@/shared/ui/PasswordChecklist';
import { PasswordInput } from '@/shared/ui/PasswordInput';

/**
 * /reset-password?token= (US-08). Queda fuera de RedirectIfAuthenticated para que el enlace
 * funcione aunque haya otra sesión abierta; al terminar se cierra la sesión local.
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onTouched',
    reValidateMode: 'onBlur',
    defaultValues: { new_password: '' },
  });

  const newPasswordValue = useWatch({ control, name: 'new_password', defaultValue: '' });

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordValues) => resetPassword({ token, ...values }),
    // El token es de un solo uso: se quita de la barra de direcciones.
    onSuccess: () => setSearchParams({}, { replace: true }),
    onError: (error) => setFormError(apiErrorMessage(t, error)),
  });

  const tokenInvalid =
    !mutation.isSuccess &&
    (!token || (isApiError(mutation.error) && mutation.error.code === 'INVALID_RESET_TOKEN'));

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  const backToLogin = (
    <Link to="/login" className={AUTH_LINK_CLASS}>
      {t('auth.backToLogin')}
    </Link>
  );

  if (mutation.isSuccess) {
    return (
      <AuthLayout variant="recovery" title={t('auth.reset.title')}>
        <FormNotice tone="info">{t('auth.reset.done')}</FormNotice>
        <Link to="/login" className={buttonVariants({ className: 'w-full' })}>
          {t('auth.reset.goLogin')}
        </Link>
      </AuthLayout>
    );
  }

  if (tokenInvalid) {
    return (
      <AuthLayout variant="recovery" title={t('auth.reset.title')} headerAction={backToLogin}>
        <FormNotice>{t('errors.INVALID_RESET_TOKEN')}</FormNotice>
        <Link to="/forgot-password" className={buttonVariants({ className: 'w-full' })}>
          {t('auth.reset.requestNew')}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      variant="recovery"
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
      headerAction={backToLogin}
    >
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <Field
          label={t('auth.fields.newPassword')}
          error={errors.new_password?.message && t(errors.new_password.message)}
        >
          {(aria) => (
            <PasswordInput {...aria} autoComplete="new-password" {...register('new_password')} />
          )}
        </Field>
        <PasswordChecklist value={newPasswordValue} />
        {formError ? <FormNotice>{formError}</FormNotice> : null}
        <Button type="submit" loading={mutation.isPending} className="w-full">
          {t('auth.reset.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
