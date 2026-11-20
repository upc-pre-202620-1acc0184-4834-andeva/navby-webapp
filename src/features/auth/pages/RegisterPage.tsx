import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { registerAccount } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { isApiError } from '@/shared/api/errors';
import { type AuthRedirectState, resolveAuthRedirectFrom } from '@/shared/auth/authRedirect';
import { getPrivacyUrl, getTermsUrl } from '@/shared/config/legalLinks';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import { LegalAnchor } from '@/shared/ui/LegalLinks';
import { TurnstileField } from '@/shared/ui/TurnstileField';
import { type RegisterValues, registerSchema } from '../authSchemas';
import { AUTH_LINK_CLASS, FormNotice } from '../components/AuthCard';
import { AuthLayout } from '../components/AuthLayout';
import { GoogleSignIn } from '../components/GoogleSignIn';
import { PasswordChecklist } from '../components/PasswordChecklist';
import { PasswordInput } from '../components/PasswordInput';
import { useCaptcha } from '../useCaptcha';

/** /register (US-01, US-05, RL-01, RN-17). */
export default function RegisterPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectFrom = resolveAuthRedirectFrom(location);
  const linkState: AuthRedirectState | undefined = redirectFrom
    ? { from: redirectFrom }
    : undefined;
  const captcha = useCaptcha();
  const [formError, setFormError] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    reValidateMode: 'onBlur',
    defaultValues: { full_name: '', email: '', password: '', accept_terms: false },
  });

  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' });

  const mutation = useMutation({
    mutationFn: (values: RegisterValues) => registerAccount(values, captcha.token),
    onSuccess: (_data, values) => {
      void navigate('/verify-email', {
        state: { email: values.email, reason: 'registered', from: redirectFrom },
      });
    },
    onError: (error, values) => {
      captcha.renew();
      const code = isApiError(error) ? error.code : null;
      if (code === 'EMAIL_ALREADY_REGISTERED') {
        setAlreadyRegistered(values.email);
        setError('email', { message: 'errors.EMAIL_ALREADY_REGISTERED' });
      } else if (code === 'DISPOSABLE_EMAIL') {
        setError('email', { message: 'errors.DISPOSABLE_EMAIL' });
      } else if (code === 'TERMS_NOT_ACCEPTED') {
        setError('accept_terms', { message: 'auth.errors.termsRequired' });
      } else {
        setFormError(apiErrorMessage(t, error));
      }
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setAlreadyRegistered(null);
    if (!captcha.token) {
      setFormError(t('auth.errors.captchaPending'));
      return;
    }
    mutation.mutate(values);
  });

  const termsErrorId = 'register-terms-error';

  const preloadLogin = () => {
    void import('./LoginPage');
  };

  const switchToLogin = (
    <>
      {t('auth.register.hasAccount')}{' '}
      <Link
        to="/login"
        state={linkState}
        onPointerEnter={preloadLogin}
        onFocus={preloadLogin}
        className={AUTH_LINK_CLASS}
      >
        {t('auth.register.toLogin')}
      </Link>
    </>
  );

  return (
    <AuthLayout
      variant="register"
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      headerAction={switchToLogin}
    >
      <GoogleSignIn />

      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <Field
          label={t('auth.fields.fullName')}
          error={errors.full_name?.message && t(errors.full_name.message)}
        >
          {(aria) => <Input {...aria} autoComplete="name" {...register('full_name')} />}
        </Field>
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
        {alreadyRegistered ? (
          <p className="-mt-2 text-sm text-fg-muted">
            <Link to="/login" state={linkState} className={AUTH_LINK_CLASS}>
              {t('auth.register.goLogin')}
            </Link>
            {' · '}
            <Link
              to="/verify-email"
              state={{ email: alreadyRegistered, from: redirectFrom } satisfies AuthRedirectState}
              className={AUTH_LINK_CLASS}
            >
              {t('auth.register.goVerify')}
            </Link>
          </p>
        ) : null}
        <Field
          label={t('auth.fields.password')}
          error={errors.password?.message && t(errors.password.message)}
        >
          {(aria) => (
            <PasswordInput {...aria} autoComplete="new-password" {...register('password')} />
          )}
        </Field>

        <PasswordChecklist value={passwordValue} />

        <div className="flex flex-col gap-1.5">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed text-fg">
            <input
              type="checkbox"
              aria-invalid={errors.accept_terms ? true : undefined}
              aria-describedby={errors.accept_terms ? termsErrorId : undefined}
              className="mt-1 h-4 w-4 shrink-0 rounded border-line-strong accent-primary"
              {...register('accept_terms')}
            />
            <span>
              <Trans
                i18nKey="auth.register.termsRich"
                components={{
                  terms: <LegalAnchor href={getTermsUrl()} />,
                  privacy: <LegalAnchor href={getPrivacyUrl()} />,
                }}
              />
            </span>
          </label>
          {errors.accept_terms?.message ? (
            <p id={termsErrorId} role="alert" className="text-xs text-error-ink">
              {t(errors.accept_terms.message)}
            </p>
          ) : null}
        </div>

        <TurnstileField
          onToken={captcha.onToken}
          resetSignal={captcha.resetSignal}
          action="register"
        />
        {formError ? <FormNotice>{formError}</FormNotice> : null}
        <Button type="submit" loading={mutation.isPending} className="w-full">
          {t('auth.register.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
