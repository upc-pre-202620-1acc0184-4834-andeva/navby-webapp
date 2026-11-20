import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { login } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { isApiError } from '@/shared/api/errors';
import { type AuthRedirectState, resolveAuthRedirectFrom } from '@/shared/auth/authRedirect';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import { TurnstileField } from '@/shared/ui/TurnstileField';
import { type LoginValues, loginSchema } from '../authSchemas';
import { AUTH_LINK_CLASS, AuthCard, FormNotice } from '../components/AuthCard';
import { GoogleSignIn } from '../components/GoogleSignIn';
import { PasswordInput } from '../components/PasswordInput';
import { useCaptcha } from '../useCaptcha';

/** /login (US-04, US-05). Al abrir sesión, RedirectIfAuthenticated vuelve a `from`. */
export default function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
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
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    reValidateMode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: LoginValues) => login(values, captcha.token),
    onError: (error, values) => {
      captcha.renew();
      if (isApiError(error) && error.code === 'EMAIL_NOT_VERIFIED') {
        void navigate('/verify-email', {
          state: {
            email: values.email,
            reason: 'unverified',
            from: redirectFrom,
          } satisfies AuthRedirectState,
        });
        return;
      }
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
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" state={linkState} className={AUTH_LINK_CLASS}>
            {t('auth.login.toRegister')}
          </Link>
        </>
      }
    >
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
          label={t('auth.fields.password')}
          error={errors.password?.message && t(errors.password.message)}
        >
          {(aria) => (
            <PasswordInput {...aria} autoComplete="current-password" {...register('password')} />
          )}
        </Field>
        <Link
          to="/forgot-password"
          state={linkState}
          className={`${AUTH_LINK_CLASS} -mt-1 self-start text-sm`}
        >
          {t('auth.login.forgot')}
        </Link>

        <TurnstileField
          onToken={captcha.onToken}
          resetSignal={captcha.resetSignal}
          action="login"
        />
        {formError ? <FormNotice>{formError}</FormNotice> : null}
        <Button type="submit" loading={mutation.isPending} className="w-full">
          {t('auth.login.submit')}
        </Button>
      </form>

      <GoogleSignIn />
    </AuthCard>
  );
}
