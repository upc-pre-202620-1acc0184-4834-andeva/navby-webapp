import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { requestPasswordReset } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { type AuthRedirectState, resolveAuthRedirectFrom } from '@/shared/auth/authRedirect';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import { TurnstileField } from '@/shared/ui/TurnstileField';
import { type ForgotPasswordValues, forgotPasswordSchema } from '../authSchemas';
import { AUTH_LINK_CLASS, AuthCard, FormNotice } from '../components/AuthCard';
import { useCaptcha } from '../useCaptcha';

/** /forgot-password (US-08). La respuesta es la misma exista o no el correo. */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const redirectFrom = resolveAuthRedirectFrom(location);
  const linkState: AuthRedirectState | undefined = redirectFrom
    ? { from: redirectFrom }
    : undefined;
  const captcha = useCaptcha();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    reValidateMode: 'onBlur',
    defaultValues: { email: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ForgotPasswordValues) => requestPasswordReset(values, captcha.token),
    onError: (error) => {
      captcha.renew();
      setFormError(apiErrorMessage(t, error));
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    if (!captcha.token) {
      setFormError(t('auth.errors.captchaPending'));
      return;
    }
    mutation.mutate(values);
  });

  return (
    <AuthCard
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      footer={
        <Link to="/login" state={linkState} className={AUTH_LINK_CLASS}>
          {t('auth.backToLogin')}
        </Link>
      }
    >
      {mutation.isSuccess ? (
        <FormNotice tone="info">{t('auth.forgot.sent')}</FormNotice>
      ) : (
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
          <Field
            label={t('auth.fields.email')}
            error={errors.email?.message && t(errors.email.message)}
          >
            {(aria) => (
              <Input
                {...aria}
                type="email"
                autoComplete="email"
                spellCheck={false}
                {...register('email')}
              />
            )}
          </Field>
          <TurnstileField
            onToken={captcha.onToken}
            resetSignal={captcha.resetSignal}
            action="forgot_password"
          />
          {formError ? <FormNotice>{formError}</FormNotice> : null}
          <Button type="submit" loading={mutation.isPending} className="w-full">
            {t('auth.forgot.submit')}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
