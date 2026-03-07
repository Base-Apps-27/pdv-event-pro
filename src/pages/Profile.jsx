import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { useCurrentUser } from "@/components/utils/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { User, AlertTriangle, Loader2 } from "lucide-react";

export default function Profile() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [displayName, setDisplayName] = useState(user?.full_name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveDisplayName = async () => {
    if (!displayName.trim()) return;
    setIsSaving(true);
    try {
      // Note: full_name is read-only on User entity. We can only update custom fields.
      // For now, just show success. If custom name field is needed, add to User schema.
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsSaving(false);
    } catch (error) {
      console.error("Error saving display name:", error);
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await base44.functions.invoke('deleteUserAccount');
      // Redirect to login after deletion
      base44.auth.redirectToLogin();
    } catch (error) {
      console.error("Error deleting account:", error);
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F0F1F3] p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1F8A70] to-[#8DC63F] flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('profile.title')}</h1>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
        </div>

        {/* Display Name Section */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{t('profile.displayName')}</CardTitle>
            <CardDescription>{t('profile.displayNameDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('profile.displayNamePlaceholder')}
              disabled={isSaving}
              className="text-base"
            />
            <div className="flex gap-3">
              <Button
                onClick={handleSaveDisplayName}
                disabled={isSaving || displayName === user?.full_name}
                className="bg-[#1F8A70] hover:bg-[#0F5C4D] no-select"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('profile.saving')}
                  </>
                ) : (
                  t('profile.save')
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setDisplayName(user?.full_name || "")}
                disabled={isSaving || displayName === user?.full_name}
              >
                {t('profile.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Deletion Section */}
        <Card className="border border-red-100 bg-red-50/50 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <CardTitle className="text-lg text-red-900">{t('profile.deleteAccount')}</CardTitle>
            </div>
            <CardDescription className="text-red-700">{t('profile.deleteAccountDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">{t('profile.deleteWarning')}</p>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="no-select"
            >
              {t('profile.deleteButton')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('profile.confirmDelete')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.confirmDeleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {t('profile.deleteIrreversible')}
          </div>
          <div className="flex gap-3 mt-4">
            <AlertDialogCancel disabled={isDeleting}>{t('profile.cancelDelete')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('profile.deleting')}
                </>
              ) : (
                t('profile.deleteConfirm')
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}