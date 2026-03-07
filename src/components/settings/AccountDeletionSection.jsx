/**
 * AccountDeletionSection — iOS App Store compliance (account deletion requirement).
 * 2026-03-07: Provides a confirmation-gated account deletion UI.
 * Calls the placeholder `deleteUserAccount` backend function.
 * 
 * Bilingual: All strings via i18n.
 */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/utils/i18n.jsx";

export default function AccountDeletionSection() {
  const { t } = useLanguage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.functions.invoke('deleteUserAccount', {});
      toast.success(t('account.deleteSuccess'));
      setConfirmOpen(false);
      // After deletion request, log the user out
      setTimeout(() => base44.auth.logout(), 2000);
    } catch (err) {
      toast.error(t('account.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="border-red-200 bg-red-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-red-700 text-base">
            <AlertTriangle className="w-5 h-5" />
            {t('account.deleteTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600/80 mb-4">
            {t('account.deleteDescription')}
          </p>
          <Button
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {t('account.deleteButton')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              {t('account.deleteConfirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-red-600/80">
              {t('account.deleteConfirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? '...' : t('account.deleteConfirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}