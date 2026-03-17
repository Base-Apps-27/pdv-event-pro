/**
 * SendPushTab — Admin form to send a custom push notification broadcast.
 * 2026-03-17: Created for PushNotifications admin page.
 *
 * Constraints (PushEngage API limits):
 *   - Title: max 85 characters
 *   - Message: max 135 characters
 *   - No deep linking — URL always goes to pdveventpro.com
 *   - The notification content is all the user will see
 *
 * This form enforces character limits with live counters and
 * a confirmation step before sending.
 */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/utils/i18n.jsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const TITLE_MAX = 85;
const MESSAGE_MAX = 135;

export default function SendPushTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const titleLen = title.length;
  const msgLen = message.length;
  const isValid = title.trim().length > 0 && message.trim().length > 0 && titleLen <= TITLE_MAX && msgLen <= MESSAGE_MAX;

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('pushNotificationAdmin', {
        action: 'send',
        title: title.trim(),
        message: message.trim(),
      });
      setResult({ success: true, data: res.data });
      setTitle('');
      setMessage('');
      setShowConfirm(false);
      // Invalidate history so new notification appears
      queryClient.invalidateQueries({ queryKey: ['push-history'] });
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info banner — no deep linking */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">{t('push.sendInfo')}</p>
            <p className="mt-1 text-blue-700">{t('push.sendInfoDetail')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Title field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('push.titleLabel')}</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              placeholder={t('push.titlePlaceholder')}
              maxLength={TITLE_MAX}
            />
            <p className={`text-xs mt-1 text-right ${titleLen > TITLE_MAX * 0.9 ? 'text-amber-600' : 'text-gray-400'}`}>
              {titleLen}/{TITLE_MAX}
            </p>
          </div>

          {/* Message field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('push.messageLabel')}</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
              placeholder={t('push.messagePlaceholder')}
              maxLength={MESSAGE_MAX}
              rows={3}
            />
            <p className={`text-xs mt-1 text-right ${msgLen > MESSAGE_MAX * 0.9 ? 'text-amber-600' : 'text-gray-400'}`}>
              {msgLen}/{MESSAGE_MAX}
            </p>
          </div>

          {/* Preview */}
          {title.trim() && message.trim() && (
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t('push.preview')}</p>
                <p className="font-semibold text-sm text-gray-900">{title}</p>
                <p className="text-sm text-gray-600">{message}</p>
              </CardContent>
            </Card>
          )}

          {/* Confirm step */}
          {!showConfirm ? (
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={!isValid}
              className="w-full bg-[#1F8A70] hover:bg-[#176e59] text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              {t('push.sendButton')}
            </Button>
          ) : (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">{t('push.confirmWarning')}</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1"
                >
                  {t('btn.cancel')}
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {sending ? t('push.sending') : t('push.confirmSend')}
                </Button>
              </div>
            </div>
          )}

          {/* Result feedback */}
          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {result.success
                ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                : <AlertTriangle className="w-5 h-5 text-red-600" />
              }
              <p className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                {result.success ? t('push.sendSuccess') : (result.error || t('push.sendError'))}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}