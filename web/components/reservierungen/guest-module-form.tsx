"use client";

// Gastmodul-Formular (.. „Gastmodul") — bündelt ZWEI Datenquellen als eine
// Fläche (bewusst getrennt gehalten, siehe ANALYSE-Doku):
//   • Portal-SCHALTER (property_guest_portal): aktiv, Self-Check-in, Türcode +
//     Anzeige-Regeln, Kontaktperson, Wartungs-Telefon, Kopfbild.
//   • Info-TEXTE (messaging in properties.type_attributes): WLAN-Info,
//     Türzugangs-Beschreibung — mehrsprachig, dieselbe Quelle wie der
//     Nachrichten-Reiter (keine Doppelpflege).
// Speichern schreibt beide Quellen. Live über useRealtime auf beiden Tabellen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { LocalizedTextEditor } from "@/components/objekte/localized-text-editor";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Switch } from "@nextdays/ui/switch";
import {
  type Messaging,
  readMessaging,
} from "@/lib/messaging-meta";
import type { LocalizedText } from "@/lib/policy-meta";
import {
  type GuestPortalSettings,
  getGuestPortal,
  saveGuestPortal,
} from "@/lib/property-portal";
import { type Property, updateProperty } from "@/lib/properties";
import { useRealtime } from "@/lib/use-realtime";

const EMPTY_SETTINGS: GuestPortalSettings = {
  enabled: false,
  contact_name: null,
  contact_phone: null,
  self_checkin: false,
  door_code: null,
  show_code_only_if_paid: false,
  hide_code_until_checkin: false,
  code_visible_from: null,
  maintenance_phone: null,
  header_image_path: null,
};

// Uhrzeit-Auswahl für „Code sichtbar ab" (Viertelstunden-Raster, wie ..).
const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, "0");
  const m = String((i % 4) * 15).padStart(2, "0");
  return `${h}:${m}`;
});

export function GuestModuleForm({ property: initial }: { property: Property }) {
  const t = useTranslations("reservations");
  // property als lokaler State: nach dem messaging-Save halten wir den
  // zurückgegebenen Server-Stand, damit ein zweites Speichern nicht auf
  // veraltetem type_attributes aufsetzt (stale-read vermeiden).
  const [property, setProperty] = useState<Property>(initial);
  const [settings, setSettings] = useState<GuestPortalSettings>(EMPTY_SETTINGS);
  const [messaging, setMessaging] = useState<Messaging>(() =>
    readMessaging(initial.type_attributes),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    const res = await getGuestPortal(property.id);
    if (res.ok) setSettings(res.data);
    setLoading(false);
  }, [property.id]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useRealtime({
    table: "property_guest_portal",
    filter: `property_id=eq.${property.id}`,
    onChange: loadSettings,
  });

  const set = <K extends keyof GuestPortalSettings>(
    key: K,
    value: GuestPortalSettings[K],
  ) => setSettings((s) => ({ ...s, [key]: value }));

  const setText = (key: keyof Messaging, value: LocalizedText) =>
    setMessaging((m) => ({ ...m, [key]: value }));

  const save = async () => {
    setSaving(true);
    // Beide Quellen speichern: Schalter (property_portal) + Texte (messaging).
    const [portalRes, msgRes] = await Promise.all([
      saveGuestPortal(property.id, settings),
      updateProperty(property.id, {
        type_attributes: { ...property.type_attributes, messaging },
      }),
    ]);
    setSaving(false);
    // Zurückgegebenen Property-Stand halten (frisches type_attributes) — sonst
    // baut ein zweites Speichern auf dem veralteten Lade-Stand auf.
    if (msgRes.ok) setProperty(msgRes.data);
    if (portalRes.ok && msgRes.ok) {
      toast.success(t("guestModuleForm.saved"));
    } else {
      toast.error(
        (!portalRes.ok && portalRes.error) ||
        (!msgRes.ok && msgRes.error) ||
        t("guestModuleForm.saveFailed"),
      );
    }
  };

  if (loading) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">{t("guestModuleForm.loading")}</Card>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">{t("guestModuleForm.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("guestModuleForm.subtitle", { propertyTitle: property.title })}
          </p>
        </div>
        <Button type="button" onClick={save} disabled={saving}>
          <Icon
            icon={saving ? "ph:spinner" : "ph:floppy-disk"}
            className={"size-4 " + (saving ? "animate-spin" : "")}
          />
          {saving ? t("guestModuleForm.saving") : t("guestModuleForm.save")}
        </Button>
      </div>

      {/* Aktiv-Schalter */}
      <Card className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold">{t("guestModuleForm.enableTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {t("guestModuleForm.enableDescription")}
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(v) => set("enabled", v)}
        />
      </Card>

      {/* Kontakt */}
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-display text-lg font-bold">{t("guestModuleForm.contactTitle")}</h2>
        <Field label={t("guestModuleForm.contactNameLabel")}>
          <Input
            value={settings.contact_name ?? ""}
            onChange={(e) => set("contact_name", e.target.value || null)}
            placeholder={t("guestModuleForm.contactNamePlaceholder")}
          />
        </Field>
        <Field label={t("guestModuleForm.contactPhoneLabel")}>
          <Input
            value={settings.contact_phone ?? ""}
            onChange={(e) => set("contact_phone", e.target.value || null)}
            placeholder={t("guestModuleForm.contactPhonePlaceholder")}
          />
        </Field>
        <Field label={t("guestModuleForm.maintenancePhoneLabel")}>
          <Input
            value={settings.maintenance_phone ?? ""}
            onChange={(e) => set("maintenance_phone", e.target.value || null)}
            placeholder={t("guestModuleForm.maintenancePhonePlaceholder")}
          />
        </Field>
      </Card>

      {/* WLAN — Text lebt in messaging.wifi (eine Wahrheit mit Nachrichten) */}
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-display text-lg font-bold">{t("guestModuleForm.wifiTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("guestModuleForm.wifiDescription", { placeholder: "{{WifiInformation}}" })}
        </p>
        <LocalizedTextEditor
          value={messaging.wifi}
          onChange={(v) => setText("wifi", v)}
          placeholder={t("guestModuleForm.wifiFieldPlaceholder")}
        />
      </Card>

      {/* Self-Check-in + Türcode */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold">{t("guestModuleForm.selfCheckinTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("guestModuleForm.selfCheckinDescription")}
            </p>
          </div>
          <Switch
            checked={settings.self_checkin}
            onCheckedChange={(v) => set("self_checkin", v)}
          />
        </div>

        {settings.self_checkin && (
          <div className="flex flex-col gap-4 border-t pt-4">
            <Field label={t("guestModuleForm.doorInstructionsLabel")}>
              <LocalizedTextEditor
                value={messaging.doorInstructions}
                onChange={(v) => setText("doorInstructions", v)}
                placeholder={t("guestModuleForm.doorInstructionsPlaceholder")}
              />
            </Field>
            <Field label={t("guestModuleForm.doorCodeLabel")}>
              <Input
                value={settings.door_code ?? ""}
                onChange={(e) => set("door_code", e.target.value || null)}
                placeholder={t("guestModuleForm.doorCodePlaceholder")}
              />
            </Field>

            <label className="flex items-center justify-between gap-4 text-sm">
              <span>{t("guestModuleForm.showCodeOnlyIfPaid")}</span>
              <Switch
                checked={settings.show_code_only_if_paid}
                onCheckedChange={(v) => set("show_code_only_if_paid", v)}
              />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>{t("guestModuleForm.hideCodeUntilCheckin")}</span>
              <Switch
                checked={settings.hide_code_until_checkin}
                onCheckedChange={(v) => set("hide_code_until_checkin", v)}
              />
            </label>
            <Field label={t("guestModuleForm.codeVisibleFromLabel")}>
              <NativeSelect
                value={settings.code_visible_from ?? ""}
                onChange={(e) =>
                  set("code_visible_from", e.target.value || null)
                }
                className="w-40"
              >
                <option value="">{t("guestModuleForm.codeVisibleFromUnset")}</option>
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
