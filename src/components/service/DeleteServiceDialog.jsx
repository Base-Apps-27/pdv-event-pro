import React, { useState } from 'react';
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

export default function DeleteServiceDialog({
  open,
  onOpenChange,
  service,
  onDeleteSuccess,
}) {
  const { t } = useLanguage();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!service?.id) return;
    
    setIsDeleting(true);
    try {
      await base44.entities.Service.delete(service.id);
      onOpenChange(false);
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (error) {
      console.error('Failed to delete service:', error);
      alert(t('custom.deleteError') || 'Failed to delete service');
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
              `Are you sure you want to delete "${service?.name}"? This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-end gap-3">
          <AlertDialogCancel disabled={isDeleting}>
            {t('common.cancel') || 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? t('common.deleting') || 'Deleting...' : (t('common.delete') || 'Delete')}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}