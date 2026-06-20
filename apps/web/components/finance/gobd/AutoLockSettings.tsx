'use client';

import { Icon } from '@iconify/react';
import {
  Alert,
  AlertDescription,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Switch,
} from '@tasko/ui';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { GoBDService } from '@/services/gobdService';
import type { GoBDSettings } from '@/types/gobdTypes';

interface AutoLockSettingsProps {
  companyId: string;
  onSettingsChange?: (settings: GoBDSettings) => void;
}

export function AutoLockSettings({ companyId, onSettingsChange }: AutoLockSettingsProps) {
  const [settings, setSettings] = useState<GoBDSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const gobdSettings = await GoBDService.getSettings(companyId);
      setSettings(gobdSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Einstellungen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSetting = async <K extends keyof GoBDSettings>(key: K, value: GoBDSettings[K]) => {
    if (!settings) return;

    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);

    try {
      setSaving(true);
      await GoBDService.updateSettings(updatedSettings);
      onSettingsChange?.(updatedSettings);
    } catch (error) {
      console.error('Failed to update setting:', error);
      // Revert on error
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const updateNotificationSetting = async (
    key: keyof GoBDSettings['notificationSettings'],
    value: boolean,
  ) => {
    if (!settings) return;

    const updatedSettings = {
      ...settings,
      notificationSettings: {
        ...settings.notificationSettings,
        [key]: value,
      },
    };

    setSettings(updatedSettings);

    try {
      setSaving(true);
      await GoBDService.updateSettings(updatedSettings);
      onSettingsChange?.(updatedSettings);
    } catch (error) {
      console.error('Failed to update notification setting:', error);
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="lucide:lock" className="h-5 w-5 text-accent" />
            Automatische Festschreibung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-3/4 rounded bg-gray-200"></div>
            <div className="h-4 w-1/2 rounded bg-gray-200"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* GoBD Info Alert */}
      <Alert className="border-blue-200 bg-blue-50">
        <Icon icon="lucide:info" className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>GoBD-Konformität:</strong> Die automatische Festschreibung gewährleistet die
          Einhaltung der Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern.
        </AlertDescription>
      </Alert>

      {/* Haupteinstellungen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="lucide:lock" className="h-5 w-5 text-accent" />
            Automatische Festschreibung
            {settings.autoLockOnSend && (
              <Badge className="border-green-200 bg-green-100 text-green-700">Aktiv</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-Lock bei Versand */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium text-base">Bei E-Mail-Versand festschreiben</Label>
              <p className="text-gray-600 text-sm">
                Dokumente werden automatisch beim Versenden per E-Mail festgeschrieben
              </p>
            </div>
            <Switch
              checked={settings.autoLockOnSend}
              onCheckedChange={checked => updateSetting('autoLockOnSend', checked)}
              disabled={saving}
            />
          </div>

          {/* Auto-Lock bei DATEV-Export */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium text-base">Bei DATEV-Export festschreiben</Label>
              <p className="text-gray-600 text-sm">
                Dokumente werden beim Export zum Steuerberater automatisch festgeschrieben
              </p>
            </div>
            <Switch
              checked={settings.autoLockOnExport}
              onCheckedChange={checked => updateSetting('autoLockOnExport', checked)}
              disabled={saving}
            />
          </div>

          {/* Storno nach Festschreibung */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium text-base">Storno nach Festschreibung erlauben</Label>
              <p className="text-gray-600 text-sm">
                Ermöglicht das Erstellen von Stornorechnungen für festgeschriebene Dokumente
              </p>
            </div>
            <Switch
              checked={settings.allowStornoAfterLock}
              onCheckedChange={checked => updateSetting('allowStornoAfterLock', checked)}
              disabled={saving}
            />
          </div>

          {/* Freigabe für Entsperrung */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium text-base">Freigabe für Entsperrung erforderlich</Label>
              <p className="text-gray-600 text-sm">
                Administratorfreigabe vor manueller Entsperrung von Dokumenten
              </p>
            </div>
            <Switch
              checked={settings.requireApprovalForUnlock}
              onCheckedChange={checked => updateSetting('requireApprovalForUnlock', checked)}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Benachrichtigungseinstellungen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="lucide:mail" className="h-5 w-5 text-accent" />
            Benachrichtigungen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium text-base">
                Erinnerung vor Festschreibungs-Deadline
              </Label>
              <p className="text-gray-600 text-sm">
                E-Mail-Erinnerung 5 Tage vor Ablauf der 30-Tage-Frist
              </p>
            </div>
            <Switch
              checked={settings.notificationSettings.lockDeadlineReminder}
              onCheckedChange={checked =>
                updateNotificationSetting('lockDeadlineReminder', checked)
              }
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium text-base">Bestätigung bei Festschreibung</Label>
              <p className="text-gray-600 text-sm">
                Benachrichtigung wenn Dokumente festgeschrieben wurden
              </p>
            </div>
            <Switch
              checked={settings.notificationSettings.lockConfirmation}
              onCheckedChange={checked => updateNotificationSetting('lockConfirmation', checked)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium text-base">Storno-Benachrichtigungen</Label>
              <p className="text-gray-600 text-sm">
                Information bei Erstellung von Stornorechnungen
              </p>
            </div>
            <Switch
              checked={settings.notificationSettings.stornoNotification}
              onCheckedChange={checked => updateNotificationSetting('stornoNotification', checked)}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Status-Übersicht */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="lucide:check-circle" className="h-5 w-5 text-accent" />
            GoBD-Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4 text-center">
              <div className="font-bold text-2xl text-green-600">
                {settings.autoLockOnSend ? '✓' : '✗'}
              </div>
              <p className="font-medium text-sm">Auto-Lock Versand</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="font-bold text-2xl text-green-600">
                {settings.autoLockOnExport ? '✓' : '✗'}
              </div>
              <p className="font-medium text-sm">Auto-Lock Export</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="font-bold text-2xl text-green-600">
                {settings.allowStornoAfterLock ? '✓' : '✗'}
              </div>
              <p className="font-medium text-sm">Storno-Funktion</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance-Hinweis */}
      {!settings.autoLockOnSend && (
        <Alert className="border-orange-200 bg-orange-50">
          <Icon icon="lucide:alert-triangle" className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Empfehlung:</strong> Aktivieren Sie die automatische Festschreibung bei
            E-Mail-Versand, um GoBD-Konformität sicherzustellen.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
