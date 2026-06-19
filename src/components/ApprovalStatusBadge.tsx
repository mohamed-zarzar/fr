import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import type { ApprovalStatus } from '@/types';

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const { t } = useTranslation();
  const variant = status === 'APPROVED' ? 'default' : status === 'REJECTED' ? 'destructive' : 'secondary';
  const label = status === 'APPROVED' ? t('common.APPROVED') : status === 'REJECTED' ? t('common.REJECTED') : t('common.PENDING');
  return <Badge variant={variant}>{label}</Badge>;
}
