import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Unlink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { sileo } from 'sileo';
import { z } from 'zod';
import { setMyPassword, unlinkGoogle } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { isApiError } from '@/shared/api/errors';
import { newPasswordSchema } from '@/shared/auth/passwordSchema';
import { sessionKeys } from '@/shared/auth/useSession';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Field } from '@/shared/ui/Field';
import { PasswordChecklist } from '@/shared/ui/PasswordChecklist';
import { PasswordInput } from '@/shared/ui/PasswordInput';

interface FormValues {
  current_password: string;
  new_password: string;
}

/**
 * Formas de acceso de /account: crear o cambiar la contraseña y desvincular Google. Google solo
 * se desvincula con contraseña (el backend responde `409 PASSWORD_REQUIRED` si no la hay).
 */
export function SecurityCard({
  hasPassword,
  hasGoogle,
}: {
  hasPassword: boolean;
  hasGoogle: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        current_password: hasPassword
          ? z.string().min(1, 'account.security.currentRequired').max(72)
          : z.string(),
        new_password: newPasswordSchema,
      }),
    [hasPassword],
  );
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', new_password: '' },
  });

  const newPasswordValue = useWatch({ control, name: 'new_password' });

  const refreshProfile = () => queryClient.invalidateQueries({ queryKey: sessionKeys.profile });

  const passwordMutation = useMutation({
    mutationFn: (values: FormValues) =>
      setMyPassword({
        new_password: values.new_password,
        ...(hasPassword ? { current_password: values.current_password } : {}),
      }),
    onSuccess: async () => {
      await refreshProfile();
      sileo.success({
        title: t(hasPassword ? 'account.security.changedDone' : 'account.security.createdDone'),
      });
      closeForm();
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: unlinkGoogle,
    onSuccess: async () => {
      await refreshProfile();
      setUnlinking(false);
      sileo.success({ title: t('account.security.unlinkDone') });
    },
  });

  function closeForm() {
    setEditing(false);
    reset();
    passwordMutation.reset();
  }

  const serverCode = isApiError(passwordMutation.error) ? passwordMutation.error.code : null;
  const currentError = errors.current_password?.message
    ? t(errors.current_password.message)
    : serverCode === 'INVALID_CURRENT_PASSWORD'
      ? apiErrorMessage(t, passwordMutation.error)
      : undefined;
  const generalError =
    passwordMutation.isError && serverCode !== 'INVALID_CURRENT_PASSWORD'
      ? apiErrorMessage(t, passwordMutation.error)
      : null;

  return (
    <Card className="flex flex-col gap-5 p-5">
      <h2 className="text-lg font-semibold text-fg">{t('account.security.title')}</h2>

      <section className="flex flex-col gap-3" aria-labelledby="security-password">
        <div>
          <h3 id="security-password" className="text-sm font-semibold text-fg">
            {t('account.security.passwordTitle')}
          </h3>
          <p className="mt-0.5 text-sm text-fg-muted">
            {t(
              hasPassword
                ? 'account.security.changeDescription'
                : 'account.security.createDescription',
            )}
          </p>
        </div>

        {editing ? (
          <form
            noValidate
            onSubmit={(e) => void handleSubmit((values) => passwordMutation.mutate(values))(e)}
            className="flex max-w-md flex-col gap-3"
          >
            {hasPassword ? (
              <Field label={t('account.security.currentPassword')} error={currentError}>
                {(aria) => (
                  <PasswordInput
                    {...aria}
                    autoComplete="current-password"
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- el usuario acaba de abrir este paso
                    autoFocus
                    {...register('current_password')}
                  />
                )}
              </Field>
            ) : null}
            <Field
              label={t('account.security.newPassword')}
              error={errors.new_password?.message && t(errors.new_password.message)}
            >
              {(aria) => (
                <PasswordInput
                  {...aria}
                  autoComplete="new-password"
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- el usuario acaba de abrir este paso
                  autoFocus={!hasPassword}
                  {...register('new_password')}
                />
              )}
            </Field>
            <PasswordChecklist value={newPasswordValue} />
            {generalError ? (
              <p role="alert" className="text-sm text-error-ink">
                {generalError}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeForm}>
                {t('account.security.cancel')}
              </Button>
              <Button type="submit" loading={passwordMutation.isPending}>
                {t(hasPassword ? 'account.security.saveChange' : 'account.security.saveCreate')}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="secondary"
            className="self-start"
            icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setEditing(true)}
          >
            {t(hasPassword ? 'account.security.change' : 'account.security.create')}
          </Button>
        )}
      </section>

      {hasGoogle ? (
        <section
          className="flex flex-col gap-3 border-t border-line pt-5"
          aria-labelledby="security-google"
        >
          <div>
            <h3 id="security-google" className="text-sm font-semibold text-fg">
              {t('account.security.googleTitle')}
            </h3>
            <p className="mt-0.5 text-sm text-fg-muted">{t('account.security.googleLinked')}</p>
          </div>
          <Button
            variant="secondary"
            className="self-start"
            disabled={!hasPassword}
            aria-describedby={hasPassword ? undefined : 'security-unlink-hint'}
            icon={<Unlink className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setUnlinking(true)}
          >
            {t('account.security.unlink')}
          </Button>
          {!hasPassword ? (
            <p id="security-unlink-hint" className="text-xs text-fg-muted">
              {t('account.security.unlinkNeedsPassword')}
            </p>
          ) : null}
        </section>
      ) : null}

      <ConfirmDialog
        open={unlinking}
        title={t('account.security.unlinkDialogTitle')}
        description={t('account.security.unlinkDialogBody')}
        confirmLabel={t('account.security.unlinkConfirm')}
        cancelLabel={t('account.security.cancel')}
        pending={unlinkMutation.isPending}
        error={unlinkMutation.isError ? apiErrorMessage(t, unlinkMutation.error) : null}
        onConfirm={() => unlinkMutation.mutate()}
        onClose={() => {
          setUnlinking(false);
          unlinkMutation.reset();
        }}
      />
    </Card>
  );
}
