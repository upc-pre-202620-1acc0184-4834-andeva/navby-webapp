import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { resendVerificationCode, verifyEmail } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { isApiError } from '@/shared/api/errors';
import { type AuthRedirectState, resolveAuthRedirectFrom } from '@/shared/auth/authRedirect';
import { useSession } from '@/shared/auth/useSession';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import { type VerifyEmailInput, type VerifyEmailValues, verifyEmailSchema } from '../authSchemas';
import { AUTH_LINK_CLASS, FormNotice } from '../components/AuthCard';
import { AuthLayout } from '../components/AuthLayout';
import { setLastAuthMethod } from '../lastAuthMethod';

const RESEND_COOLDOWN_S = 60;

/** /verify-email (US-02, US-03). Al verificar, RedirectIfAuthenticated vuelve a `from`. */
export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useSession();
  const state = location.state as AuthRedirectState | null;
  const redirectFrom = resolveAuthRedirectFrom(location);
  const linkState: AuthRedirectState | undefined = redirectFrom
    ? { from: redirectFrom }
    : undefined;

  // Recién registrado: el backend ya envió un código, así que el reenvío espera 60 s.
  const [secondsLeft, setSecondsLeft] = useState(
    state?.reason === 'registered' ? RESEND_COOLDOWN_S : 0,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  const {
    register,
    handleSubmit,
    setError,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<VerifyEmailInput, unknown, VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    mode: 'onTouched',
    reValidateMode: 'onBlur',
    defaultValues: { email: state?.email ?? user?.email ?? '', code: '' },
  });

  const verify = useMutation({
    mutationFn: verifyEmail,
    onSuccess: () => setLastAuthMethod('password'),
    onError: (error) => {
      const code = isApiError(error) ? error.code : null;
      if (code === 'INVALID_OTP' || code === 'OTP_ATTEMPTS_EXCEEDED') {
        setError('code', { message: `errors.${code}` });
      } else {
        setFormError(apiErrorMessage(t, error));
      }
    },
  });

  const resend = useMutation({
    mutationFn: resendVerificationCode,
    onSuccess: () => {
      setResent(true);
      setSecondsLeft(RESEND_COOLDOWN_S);
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'RATE_LIMITED') setSecondsLeft(RESEND_COOLDOWN_S);
      setFormError(apiErrorMessage(t, error));
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    verify.mutate(values);
  });

  const onResend = async () => {
    setFormError(null);
    setResent(false);
    if (!(await trigger('email'))) return;
    resend.mutate({ email: verifyEmailSchema.shape.email.parse(getValues('email')) });
  };

  const backToLogin = (
    <Link to="/login" state={linkState} className={AUTH_LINK_CLASS}>
      {t('auth.backToLogin')}
    </Link>
  );

  return (
    <AuthLayout
      variant="verify"
      title={t('auth.verify.title')}
      subtitle={t('auth.verify.subtitle')}
      headerAction={backToLogin}
    >
      {state?.reason ? (
        <FormNotice tone="info">
          {t(state.reason === 'registered' ? 'auth.verify.sent' : 'auth.verify.unverified')}
        </FormNotice>
      ) : null}

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
        <Field
          label={t('auth.fields.code')}
          hint={t('auth.fields.codeHint')}
          error={errors.code?.message && t(errors.code.message)}
        >
          {(aria) => (
            <Input
              {...aria}
              inputMode="numeric"
              autoComplete="one-time-code"
              spellCheck={false}
              className="tracking-[0.3em] tabular-nums"
              {...register('code')}
            />
          )}
        </Field>
        {formError ? <FormNotice>{formError}</FormNotice> : null}
        {resent ? <FormNotice tone="info">{t('auth.verify.resent')}</FormNotice> : null}
        <Button type="submit" loading={verify.isPending} className="w-full">
          {t('auth.verify.submit')}
        </Button>
        <Button
          variant="secondary"
          className="w-full tabular-nums"
          loading={resend.isPending}
          disabled={secondsLeft > 0}
          onClick={() => void onResend()}
        >
          {secondsLeft > 0
            ? t('auth.verify.resendIn', { seconds: secondsLeft })
            : t('auth.verify.resend')}
        </Button>
      </form>
    </AuthLayout>
  );
}
