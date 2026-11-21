import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, LogOut, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { sileo } from 'sileo';
import { z } from 'zod';
import { deleteMyAccount, getMyProfile } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { sessionKeys, useLogout, useSession } from '@/shared/auth/useSession';
import { PreferenceSelector } from '@/shared/preferences/PreferenceSelector';
import {
  type PreferenceSelection,
  readDefaultPreference,
  writeDefaultPreference,
} from '@/shared/preferences/preferences';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import { LegalLinksRow } from '@/shared/ui/LegalLinks';
import { SecurityCard } from '../components/SecurityCard';

/** /account (US-07, US-09, US-10, RL-02). */
export default function AccountPage() {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const profile = useQuery({
    queryKey: sessionKeys.profile,
    queryFn: ({ signal }) => getMyProfile(signal),
  });
  const logout = useLogout();

  const [defaultPref, setDefaultPref] = useState<PreferenceSelection>(() =>
    readDefaultPreference(user?.user_id),
  );
  const [prefSaved, setPrefSaved] = useState(false);

  const handleDefaultPrefChange = (next: PreferenceSelection) => {
    setDefaultPref(next);
    writeDefaultPreference(user?.user_id, next);
    setPrefSaved(true);
  };

  const [confirming, setConfirming] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const keyword = t('account.delete.keyword');
  const schema = useMemo(
    () =>
      z.object({
        confirmation: z.string().refine((v) => v === keyword, 'account.delete.mismatch'),
      }),
    [keyword],
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ confirmation: string }>({
    resolver: zodResolver(schema),
    defaultValues: { confirmation: '' },
  });

  const deletion = useMutation({
    // navby-platform acepta «ELIMINAR» (es) o «DELETE» (en): se envía lo que pidió la interfaz.
    mutationFn: (confirmation: string) => deleteMyAccount({ confirmation }),
    onSuccess: () => sileo.success({ title: t('account.delete.done') }),
  });

  const onLogout = () =>
    logout.mutate(undefined, {
      onError: (error) =>
        sileo.error({ title: t('account.logoutFailed'), description: apiErrorMessage(t, error) }),
    });

  const cancelDelete = () => {
    flushSync(() => setConfirming(false));
    reset();
    deletion.reset();
    deleteTriggerRef.current?.focus();
  };

  const data = profile.data;
  const fullName = data?.full_name ?? user?.full_name ?? '';
  const email = data?.email ?? user?.email ?? '';
  const verified = data?.email_verified ?? user?.email_verified ?? false;
  const createdAt = data
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'es', { dateStyle: 'long' }).format(
        new Date(data.created_at),
      )
    : null;
  const pending = <span className="text-fg-muted">{t('common.loading')}</span>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-fg">{t('account.title')}</h1>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-fg">{fullName}</h2>
            <p className="truncate text-sm text-fg-muted">{email}</p>
          </div>
          <Badge variant={verified ? 'success' : 'warning'}>
            {t(verified ? 'account.verified' : 'account.unverified')}
          </Badge>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-fg-muted">{t('account.methods')}</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {data ? (
                <>
                  {data.has_password ? <Badge>{t('account.methodPassword')}</Badge> : null}
                  {data.has_google ? <Badge>{t('account.methodGoogle')}</Badge> : null}
                </>
              ) : (
                pending
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-fg-muted">{t('account.createdAt')}</dt>
            <dd className="mt-1 text-fg">{createdAt ?? pending}</dd>
          </div>
        </dl>

        {profile.isError ? (
          <p role="alert" className="text-sm text-error-ink">
            {apiErrorMessage(t, profile.error)}{' '}
            <button
              type="button"
              className="font-semibold underline underline-offset-4"
              onClick={() => void profile.refetch()}
            >
              {t('common.retry')}
            </button>
          </p>
        ) : null}

        <div className="border-t border-line pt-4">
          <Button
            variant="secondary"
            icon={<LogOut className="h-4 w-4" aria-hidden="true" />}
            loading={logout.isPending}
            onClick={onLogout}
          >
            {t('account.logout')}
          </Button>
        </div>
      </Card>

      {data ? <SecurityCard hasPassword={data.has_password} hasGoogle={data.has_google} /> : null}

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-fg">
              {t('account.defaultPreference.title')}
            </h2>
            <p className="mt-0.5 text-sm text-fg-muted">
              {t('account.defaultPreference.description')}
            </p>
          </div>
          {prefSaved ? (
            <Badge variant="success">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('account.defaultPreference.saved')}</span>
            </Badge>
          ) : null}
        </div>

        <PreferenceSelector
          selection={defaultPref}
          onChange={handleDefaultPrefChange}
          columns={4}
          hideLegend={true}
          legend={t('account.defaultPreference.title')}
        />
      </Card>

      <Card className="flex flex-col gap-3 border-error-ink/40 p-5">
        <h2 className="text-lg font-semibold text-fg">{t('account.delete.title')}</h2>
        <p className="text-sm text-fg-muted">{t('account.delete.description')}</p>

        {confirming ? (
          <form
            noValidate
            onSubmit={(e) =>
              void handleSubmit(({ confirmation }) => deletion.mutate(confirmation))(e)
            }
            className="flex flex-col gap-3"
          >
            <Field
              label={t('account.delete.label', { keyword })}
              error={
                errors.confirmation?.message
                  ? t(errors.confirmation.message, { keyword })
                  : deletion.isError
                    ? apiErrorMessage(t, deletion.error)
                    : undefined
              }
            >
              {(aria) => (
                <Input
                  {...aria}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- el usuario acaba de abrir este paso
                  autoFocus
                  {...register('confirmation')}
                />
              )}
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={cancelDelete}>
                {t('account.delete.cancel')}
              </Button>
              <Button type="submit" variant="danger" loading={deletion.isPending}>
                {t('account.delete.confirm')}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            ref={deleteTriggerRef}
            variant="danger"
            className="self-start"
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setConfirming(true)}
          >
            {t('account.delete.open')}
          </Button>
        )}
      </Card>

      <LegalLinksRow className="pt-1" />
    </div>
  );
}
