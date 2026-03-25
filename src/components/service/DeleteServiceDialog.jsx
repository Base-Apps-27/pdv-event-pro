import React from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/utils/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * 2026-03-25: Soft-delete dialog for Services (Decision: soft-delete over hard-delete).
 * Sets status='deleted' + deleted_at/deleted_by metadata instead of destroying the record.
 * Child Sessions are NOT cascade-deleted — they remain linked for restore fidelity.
 */
export default function DeleteServiceDialog({
  open,
  onOpenChange,
  service,
  onDeleteSuccess,
}) {
  const { t } = useLanguage();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleSoftDelete = async () => {
    if (!service?.id) return;

    setIsDeleting(true);
    try {
      // Get current user email for audit trail
      let userEmail = 'unknown';
      try {
        const me = await base44.auth.me();
        userEmail = me?.email || 'unknown';
      } catch { /* proceed with unknown */ }

      // Soft-delete: set status to 'deleted' with audit metadata
      await base44.entities.Service.update(service.id, {
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        deleted_by: userEmail,
      });

      onOpenChange(false);
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (error) {
      console.error('Failed to soft-delete service:', error);
      const { toast } = await import('sonner');
      toast.error(t('custom.deleteError') || 'Failed to delete service');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('custom.deleteTitle') || 'Delete Service?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('custom.deleteConfirm')?.replace('{name}', service?.name || '') ||
              `Are you sure you want to delete "${service?.name}"? You can restore it later from the trash.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-end gap-3">
          <AlertDialogCancel disabled={isDeleting}>
            {t('common.cancel') || 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSoftDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting
              ? (t('common.deleting') || 'Deleting...')
              : (t('common.delete') || 'Delete')}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}