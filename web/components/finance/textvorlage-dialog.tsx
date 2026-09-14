'use client';

// Textvorlage anlegen — aus dem Kopf-/Fußtext-Menü des Beleg-Editors.
//
// Zwei Reiter: „Vorlage" (Name, Verwendung, Position, Sprache, Text mit
// Platzhaltern, Standard) und „KI-Vorschlag" (ein Satz Wunsch → Vorschlag
// über den zentralen KI-Endpunkt, landet im Textfeld). Ersetzt das aus taskilo
// portierte Modal mit Farbverlauf-Kopf: dieser Dialog nutzt ausschließlich
// das Design-System (Dialog, Pill-Umschalter wie Netto/Brutto, Info-Icons).
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@nextdays/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@nextdays/ui/dialog';
import { InfoHinweis } from '@nextdays/ui/info-hinweis';
import { Input } from '@nextdays/ui/input';
import { Label } from '@nextdays/ui/label';
import { NativeSelect } from '@nextdays/ui/native-select';
import { Switch } from '@nextdays/ui/switch';
import { Textarea } from '@nextdays/ui/textarea';
import { DOCUMENT_LANGUAGE_LABELS, DOCUMENT_LANGUAGES } from '@/hooks/pdf/document-translations';
import { kiTextbaustein } from '@/lib/buchhaltung-versand';
import { PLATZHALTER } from '@/lib/buchhaltung-versand-typen';
import type { ObjectType, TextTemplate, TextTemplateType } from '@/types/textTemplates';

type Reiter = 'vorlage' | 'ki';
type Neu = Omit<TextTemplate, 'id' | 'createdAt' | 'updatedAt'>;

const OBJEKTARTEN: readonly ObjectType[] = [
  'QUOTE',
  'INVOICE',
  'REMINDER',
  'CREDIT_NOTE',
  'CANCELLATION',
];

function ReiterKnopf({
  aktiv,
  onClick,
  icon,
  label,
}: {
  aktiv: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={aktiv}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        aktiv ? 'bg-accent text-white' : 'text-muted-foreground hover:bg-secondary'
      }`}
    >
      <Icon icon={icon} className="size-4" />
      {label}
    </button>
  );
}

type VorlageReiterProps = {
  name: string;
  setName: (v: string) => void;
  objectType: ObjectType;
  setObjectType: (v: ObjectType) => void;
  textType: TextTemplateType;
  setTextType: (v: TextTemplateType) => void;
  sprache: string;
  setSprache: (v: string) => void;
  text: string;
  setText: (v: string) => void;
  isDefault: boolean;
  setIsDefault: (v: boolean) => void;
  textRef: React.RefObject<HTMLTextAreaElement | null>;
  platzhalterEinfuegen: (ph: string) => void;
};

function VorlageReiter(p: VorlageReiterProps) {
  const t = useTranslations('finance');
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="tvd-name">{t('textvorlageDialog.name')}</Label>
        <Input
          id="tvd-name"
          value={p.name}
          onChange={e => p.setName(e.target.value)}
          placeholder={t('textvorlageDialog.namePlaceholder')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tvd-objekt">{t('textvorlageDialog.objectType')}</Label>
          <NativeSelect
            id="tvd-objekt"
            value={p.objectType}
            onChange={e => p.setObjectType(e.target.value as ObjectType)}
          >
            {OBJEKTARTEN.map(o => (
              <option key={o} value={o}>
                {t(`textvorlageDialog.objectTypes.${o}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tvd-position">{t('textvorlageDialog.textType')}</Label>
          <NativeSelect
            id="tvd-position"
            value={p.textType}
            onChange={e => p.setTextType(e.target.value as TextTemplateType)}
          >
            <option value="HEAD">{t('textvorlageDialog.textTypes.HEAD')}</option>
            <option value="FOOT">{t('textvorlageDialog.textTypes.FOOT')}</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tvd-sprache">{t('textvorlageDialog.language')}</Label>
          <NativeSelect
            id="tvd-sprache"
            value={p.sprache}
            onChange={e => p.setSprache(e.target.value)}
          >
            {DOCUMENT_LANGUAGES.map(code => (
              <option key={code} value={code}>
                {DOCUMENT_LANGUAGE_LABELS[code] ?? code}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="tvd-text">{t('textvorlageDialog.text')}</Label>
          <InfoHinweis
            ariaLabel={t('textvorlageDialog.textInfoAria')}
            text={t('textvorlageDialog.textInfo')}
          />
        </div>
        <Textarea
          id="tvd-text"
          ref={p.textRef}
          rows={7}
          value={p.text}
          onChange={e => p.setText(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {PLATZHALTER.map(ph => (
            <button
              key={ph}
              type="button"
              className="rounded-full border border-border bg-secondary/40 px-2.5 py-0.5 font-mono text-xs transition-colors hover:bg-secondary"
              onClick={() => p.platzhalterEinfuegen(ph)}
            >
              {ph}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="tvd-default">{t('textvorlageDialog.default')}</Label>
          <InfoHinweis
            ariaLabel={t('textvorlageDialog.defaultInfoAria')}
            text={t('textvorlageDialog.defaultInfo')}
          />
        </div>
        <Switch id="tvd-default" checked={p.isDefault} onCheckedChange={p.setIsDefault} />
      </div>
    </div>
  );
}

function KiReiter({
  wunsch,
  setWunsch,
  objectType,
  textType,
  sprache,
  laeuft,
  gesperrt,
  onErzeugen,
}: {
  wunsch: string;
  setWunsch: (v: string) => void;
  objectType: ObjectType;
  textType: TextTemplateType;
  sprache: string;
  laeuft: boolean;
  gesperrt: boolean;
  onErzeugen: () => void;
}) {
  const t = useTranslations('finance');
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-2 rounded-(--radius) border border-dashed p-3 text-sm text-muted-foreground">
        <Icon icon="ph:sparkle" className="mt-0.5 size-4 shrink-0 text-violet-600" />
        <span>{t('textvorlageDialog.aiHint')}</span>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tvd-wunsch">{t('textvorlageDialog.aiWish')}</Label>
        <Textarea
          id="tvd-wunsch"
          rows={3}
          maxLength={1000}
          value={wunsch}
          onChange={e => setWunsch(e.target.value)}
          placeholder={t('textvorlageDialog.aiWishPlaceholder')}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t('textvorlageDialog.aiFor', {
          objectType: t(`textvorlageDialog.objectTypes.${objectType}`),
          textType: t(`textvorlageDialog.textTypes.${textType}`),
          language: DOCUMENT_LANGUAGE_LABELS[sprache] ?? sprache,
        })}
      </p>
      <div>
        <Button type="button" className="rounded-full" disabled={gesperrt} onClick={onErzeugen}>
          <Icon icon="ph:sparkle" className="mr-1.5 size-4" />
          {laeuft ? t('textvorlageDialog.aiRunning') : t('textvorlageDialog.aiGenerate')}
        </Button>
      </div>
    </div>
  );
}

/** Vorlagen liegen als HTML (TipTap-Editor). Im Dialog wird reiner Text bearbeitet —
 *  Absätze durch Leerzeile, Umbrüche durch Zeilenwechsel; „<br/>" im Feld versteht kein Kunde. */
function zuHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .trim()
    .split(/\n{2,}/)
    .map(absatz => `<p>${esc(absatz).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Umkehrung für KI-Antworten oder alte HTML-Vorlagen. */
function zuText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/?p>/gi, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

type FormularArgs = {
  isOpen: boolean;
  vorgabeObjekt: ObjectType;
  vorgabePosition: TextTemplateType;
  vorgabeSprache: string;
  companyId: string;
  userId: string;
  onSave: (template: Neu) => Promise<void>;
  onClose: () => void;
  nachKi: () => void;
};

/** Formularzustand des Dialogs: Reset beim Öffnen, Platzhalter, KI-Vorschlag, Speichern. */
function useVorlageFormular(a: FormularArgs) {
  const t = useTranslations('finance');
  const [name, setName] = useState('');
  const [objectType, setObjectType] = useState<ObjectType>(a.vorgabeObjekt);
  const [textType, setTextType] = useState<TextTemplateType>(a.vorgabePosition);
  const [sprache, setSprache] = useState(a.vorgabeSprache);
  const [text, setText] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [wunsch, setWunsch] = useState('');
  const [laeuft, setLaeuft] = useState<'ki' | 'speichern' | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Beim Öffnen auf die Vorgaben des aufrufenden Editors zurücksetzen.
  useEffect(() => {
    if (!a.isOpen) return;
    setName('');
    setObjectType(a.vorgabeObjekt);
    setTextType(a.vorgabePosition);
    setSprache(a.vorgabeSprache);
    setText('');
    setIsDefault(false);
    setWunsch('');
  }, [a.isOpen, a.vorgabeObjekt, a.vorgabePosition, a.vorgabeSprache]);

  const platzhalterEinfuegen = (ph: string) => {
    const el = textRef.current;
    const start = el?.selectionStart ?? text.length;
    const ende = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + ph + text.slice(ende));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + ph.length, start + ph.length);
    });
  };

  const kiErzeugen = async () => {
    setLaeuft('ki');
    const res = await kiTextbaustein({ objectType, textType, language: sprache, wunsch });
    setLaeuft(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setText(zuText(res.data.text));
    if (!name.trim()) {
      setName(
        `${t(`textvorlageDialog.objectTypes.${objectType}`)} – ${t(`textvorlageDialog.textTypes.${textType}`)} (KI)`,
      );
    }
    a.nachKi();
    toast.success(
      t('textvorlageDialog.kiDone', { used: res.data.verbrauch_heute, limit: res.data.tageslimit }),
    );
  };

  const speichern = async () => {
    if (!name.trim() || !text.trim()) {
      toast.error(t('textvorlageDialog.fieldsRequired'));
      return;
    }
    setLaeuft('speichern');
    try {
      await a.onSave({
        name: name.trim(),
        category: 'DOCUMENT',
        objectType,
        textType,
        text: zuHtml(text),
        isDefault,
        isPrivate: false,
        companyId: a.companyId,
        createdBy: a.userId,
      });
      toast.success(t('textvorlageDialog.saved'));
      a.onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('textvorlageDialog.saveError'));
    } finally {
      setLaeuft(null);
    }
  };

  return {
    name,
    setName,
    objectType,
    setObjectType,
    textType,
    setTextType,
    sprache,
    setSprache,
    text,
    setText,
    isDefault,
    setIsDefault,
    wunsch,
    setWunsch,
    laeuft,
    textRef,
    platzhalterEinfuegen,
    kiErzeugen,
    speichern,
  };
}

export default function TextvorlageDialog({
  isOpen,
  onClose,
  onSave,
  companyId,
  userId,
  objectType: vorgabeObjekt = 'QUOTE',
  textType: vorgabePosition = 'HEAD',
  language: vorgabeSprache = 'de',
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: Neu) => Promise<void>;
  companyId: string;
  userId: string;
  objectType?: ObjectType;
  textType?: TextTemplateType;
  language?: string;
}) {
  const t = useTranslations('finance');
  const [reiter, setReiter] = useState<Reiter>('vorlage');
  const f = useVorlageFormular({
    isOpen,
    vorgabeObjekt,
    vorgabePosition,
    vorgabeSprache,
    companyId,
    userId,
    onSave,
    onClose,
    nachKi: () => setReiter('vorlage'),
  });
  const { laeuft } = f;

  useEffect(() => {
    if (isOpen) setReiter('vorlage');
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="font-display text-xl font-extrabold">
          {t('textvorlageDialog.title')}
        </DialogTitle>
        <DialogDescription>{t('textvorlageDialog.description')}</DialogDescription>

        <div role="tablist" className="flex w-fit gap-1 rounded-full border p-1">
          <ReiterKnopf
            aktiv={reiter === 'vorlage'}
            onClick={() => setReiter('vorlage')}
            icon="ph:text-align-left"
            label={t('textvorlageDialog.tabTemplate')}
          />
          <ReiterKnopf
            aktiv={reiter === 'ki'}
            onClick={() => setReiter('ki')}
            icon="ph:sparkle"
            label={t('textvorlageDialog.tabAi')}
          />
        </div>

        {reiter === 'vorlage' ? (
          <VorlageReiter
            name={f.name}
            setName={f.setName}
            objectType={f.objectType}
            setObjectType={f.setObjectType}
            textType={f.textType}
            setTextType={f.setTextType}
            sprache={f.sprache}
            setSprache={f.setSprache}
            text={f.text}
            setText={f.setText}
            isDefault={f.isDefault}
            setIsDefault={f.setIsDefault}
            textRef={f.textRef}
            platzhalterEinfuegen={f.platzhalterEinfuegen}
          />
        ) : (
          <KiReiter
            wunsch={f.wunsch}
            setWunsch={f.setWunsch}
            objectType={f.objectType}
            textType={f.textType}
            sprache={f.sprache}
            laeuft={laeuft === 'ki'}
            gesperrt={laeuft !== null}
            onErzeugen={() => void f.kiErzeugen()}
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={onClose}
            disabled={laeuft !== null}
          >
            {t('textvorlageDialog.cancel')}
          </Button>
          <Button
            type="button"
            className="rounded-full"
            onClick={() => void f.speichern()}
            disabled={laeuft !== null}
          >
            {laeuft === 'speichern' ? t('textvorlageDialog.saving') : t('textvorlageDialog.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
