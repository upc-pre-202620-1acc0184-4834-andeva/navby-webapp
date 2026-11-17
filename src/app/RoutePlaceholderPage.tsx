import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { Card } from '@/shared/ui/Card';

export interface RoutePlaceholderPageProps {
  titleKey: string;
  descriptionKey: string;
  actionTo?: string;
  actionLabelKey?: string;
}

export function RoutePlaceholderPage({
  titleKey,
  descriptionKey,
  actionTo,
  actionLabelKey,
}: RoutePlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <div className="grid flex-1 place-items-center px-4 py-8">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-fg">{t(titleKey)}</h1>
        <p className="mt-2 text-sm text-fg-muted">{t(descriptionKey)}</p>
        {actionTo && actionLabelKey ? (
          <div className="mt-4">
            <Link to={actionTo} className={buttonVariants({ variant: 'secondary' })}>
              {t(actionLabelKey)}
            </Link>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
