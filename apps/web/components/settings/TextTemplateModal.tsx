'use client';

import { Icon } from '@iconify/react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Input,
  Label,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tasko/ui';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  CATEGORY_OPTIONS,
  DOCUMENT_POSITION_OPTIONS,
  DOCUMENT_USAGE_OPTIONS,
  EMAIL_POSITION_OPTIONS,
  LETTER_POSITION_OPTIONS,
  type ObjectType,
  PLACEHOLDER_CATEGORIES,
  type TextTemplate,
  type TextTemplateCategory,
  type TextTemplateType,
} from '@/types/textTemplates';

// biome-ignore lint/correctness/noUnusedVariables: declaration merging — TypeScript merges this with the second interface declaration of the same name below. Both are referenced.
interface TextTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: Omit<TextTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  template?: TextTemplate | null;
  companyId: string;
  userId: string;
}

// Info-Tooltip Komponente
function InfoTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon
            icon="lucide:info"
            className="h-4 w-4 cursor-help text-gray-400 transition-colors hover:text-accent"
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs bg-gray-900 p-2 text-white text-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Kategorie-Icon
function CategoryIcon({ category }: { category: TextTemplateCategory }) {
  switch (category) {
    case 'DOCUMENT':
      return <Icon icon="lucide:file-text" className="h-4 w-4" />;
    case 'EMAIL':
      return <Icon icon="lucide:mail" className="h-4 w-4" />;
    case 'LETTER':
      return <Icon icon="lucide:file-edit" className="h-4 w-4" />;
    default:
      return <Icon icon="lucide:file-text" className="h-4 w-4" />;
  }
}

interface TextTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: Omit<TextTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  template?: TextTemplate | null;
  companyId: string;
  userId: string;
}

export default function TextTemplateModal({
  isOpen,
  onClose,
  onSave,
  template,
  companyId,
  userId,
}: TextTemplateModalProps) {
  const [formData, setFormData] = useState<{
    name: string;
    category: TextTemplateCategory;
    objectType: ObjectType;
    textType: TextTemplateType;
    text: string;
    isDefault: boolean;
    isPrivate: boolean;
  }>({
    name: '',
    category: 'DOCUMENT',
    objectType: 'QUOTE',
    textType: 'HEAD',
    text: '',
    isDefault: false,
    isPrivate: false,
  });
  const [loading, setLoading] = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (template) {
        setFormData({
          name: template.name,
          category: template.category,
          objectType: template.objectType,
          textType: template.textType,
          text: template.text,
          isDefault: template.isDefault,
          isPrivate: template.isPrivate,
        });
      } else {
        setFormData({
          name: '',
          category: 'DOCUMENT',
          objectType: 'QUOTE',
          textType: 'HEAD',
          text: '',
          isDefault: false,
          isPrivate: false,
        });
      }
    }
  }, [isOpen, template]);

  const handleSave = async () => {
    toast.info('handleSave aufgerufen - Debug');

    if (!formData.name.trim()) {
      toast.error('Bitte geben Sie einen Namen für die Textvorlage ein.');
      return;
    }

    if (!formData.text.trim()) {
      toast.error('Bitte geben Sie einen Text für die Vorlage ein.');
      return;
    }

    toast.info(`Speichere Template: ${formData.name} - companyId: ${companyId}, userId: ${userId}`);

    try {
      setLoading(true);
      const templateData = {
        ...formData,
        companyId,
        createdBy: userId,
      };
      await onSave(templateData);
      toast.success(
        template ? 'Textvorlage erfolgreich aktualisiert!' : 'Textvorlage erfolgreich erstellt!',
      );
      onClose();
    } catch (error) {
      toast.error(
        `Fehler beim Speichern: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const currentText = formData.text;
    const newText = currentText + placeholder;
    setFormData(prev => ({ ...prev, text: newText }));
  };

  const getPositionOptions = () => {
    if (formData.category === 'DOCUMENT') return DOCUMENT_POSITION_OPTIONS;
    if (formData.category === 'EMAIL') return EMAIL_POSITION_OPTIONS;
    if (formData.category === 'LETTER') return LETTER_POSITION_OPTIONS;
    return DOCUMENT_POSITION_OPTIONS;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 p-0">
        {/* Header - Kompakt */}
        <div className="shrink-0 rounded-t-lg bg-linear-to-r from-accent to-teal-600 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 font-bold text-white text-xl">
            <Icon icon="lucide:sparkles" className="h-5 w-5" />
            {template ? 'Textvorlage bearbeiten' : 'Neue Textvorlage'}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-teal-100">
            Wiederverwendbare Textbausteine für Dokumente und E-Mails
          </DialogDescription>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {/* Abschnitt 1: Name & Typ (wichtigste Felder oben) */}
            <div className="space-y-4">
              {/* Name - Prominentes Feld */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="name" className="font-semibold text-gray-900 text-sm">
                    Vorlagen-Name
                  </Label>
                  <span className="text-red-500 text-xs">*</span>
                  <InfoTooltip content="Geben Sie einen eindeutigen Namen für die Vorlage ein, z.B. 'Angebot Kopftext Standard' oder 'Mahnung Stufe 1'." />
                </div>
                <Input
                  id="name"
                  placeholder="z.B. Angebot Standardtext, Mahnung Stufe 1..."
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="h-11 border-gray-300 text-base focus-visible:ring-accent"
                />
              </div>

              {/* Typ-Auswahl als Buttons */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="font-semibold text-gray-900 text-sm">Vorlagen-Typ</Label>
                  <InfoTooltip content="Wählen Sie den Typ: Dokument (Rechnungen, Angebote), E-Mail (Versand-Mails) oder Brief (Geschäftsbriefe)." />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORY_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        const category = option.value as TextTemplateCategory;
                        setFormData(prev => ({
                          ...prev,
                          category: category,
                          textType:
                            category === 'DOCUMENT'
                              ? 'HEAD'
                              : category === 'EMAIL'
                                ? 'BODY'
                                : 'HEAD',
                        }));
                      }}
                      className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 transition-all ${
                        formData.category === option.value
                          ? 'border-accent bg-teal-50 font-medium text-accent'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <CategoryIcon category={option.value as TextTemplateCategory} />
                      <span className="text-sm">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Separator className="bg-gray-100" />

            {/* Abschnitt 2: Verwendung & Position (nebeneinander) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="font-semibold text-gray-900 text-sm">Verwenden für</Label>
                  <InfoTooltip content="Legen Sie fest, für welche Dokumentart diese Vorlage verwendet werden soll." />
                </div>
                {formData.category === 'DOCUMENT' ? (
                  <Select
                    value={formData.objectType}
                    onValueChange={value =>
                      setFormData(prev => ({ ...prev, objectType: value as ObjectType }))
                    }
                  >
                    <SelectTrigger className="h-10 focus:ring-accent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_USAGE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500 text-sm">
                    {formData.category === 'EMAIL' ? 'E-Mail Template' : 'Brief Template'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="font-semibold text-gray-900 text-sm">Position</Label>
                  <InfoTooltip content="Kopf-Text erscheint oben im Dokument, Fuß-Text unten. Bei E-Mails: Betreff, Text oder Signatur." />
                </div>
                <Select
                  value={formData.textType}
                  onValueChange={value =>
                    setFormData(prev => ({ ...prev, textType: value as TextTemplateType }))
                  }
                >
                  <SelectTrigger className="h-10 focus:ring-accent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getPositionOptions().map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="bg-gray-100" />

            {/* Abschnitt 3: Text-Eingabe */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="font-semibold text-gray-900 text-sm">Text-Inhalt</Label>
                  <span className="text-red-500 text-xs">*</span>
                  <InfoTooltip content="Geben Sie den gewünschten Text ein. Verwenden Sie Platzhalter wie [%KUNDENNAME%] für dynamische Inhalte." />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPlaceholders(!showPlaceholders)}
                  className="h-7 px-2 text-accent text-xs hover:bg-teal-50 hover:text-teal-700"
                >
                  {showPlaceholders ? (
                    <>
                      Platzhalter ausblenden{' '}
                      <Icon icon="lucide:chevron-up" className="ml-1 h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Platzhalter anzeigen{' '}
                      <Icon icon="lucide:chevron-down" className="ml-1 h-3 w-3" />
                    </>
                  )}
                </Button>
              </div>

              <Textarea
                value={formData.text}
                onChange={e => setFormData(prev => ({ ...prev, text: e.target.value }))}
                placeholder="Sehr geehrte/r [%ANREDE%] [%KUNDENNAME%],

vielen Dank für Ihre Anfrage. Anbei erhalten Sie unser Angebot..."
                className="max-h-75 min-h-40 resize-y border-gray-300 text-sm focus-visible:ring-accent"
              />

              <p className="flex items-center gap-1 text-gray-500 text-xs">
                <Icon icon="lucide:info" className="h-3 w-3" />
                Tipp: HTML-Formatierung und Platzhalter wie [%KUNDENNAME%] werden unterstützt
              </p>
            </div>

            {/* Platzhalter-Bereich (ausklappbar) */}
            {showPlaceholders && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h4 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 text-sm">
                  <Icon icon="lucide:copy" className="h-4 w-4 text-accent" />
                  Verfügbare Platzhalter
                </h4>
                <ScrollArea className="h-48">
                  <div className="space-y-3 pr-4">
                    {Object.entries(PLACEHOLDER_CATEGORIES).map(([categoryKey, category]) => (
                      <div key={categoryKey}>
                        <h5 className="mb-2 font-medium text-gray-600 text-xs">{category.label}</h5>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(category.placeholders).map(([placeholder, info]) => (
                            <TooltipProvider key={placeholder} delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className="cursor-pointer font-mono text-xs transition-colors hover:border-accent hover:bg-accent hover:text-white"
                                    onClick={() => insertPlaceholder(placeholder)}
                                  >
                                    {placeholder}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="font-medium">{info.description}</p>
                                  <p className="mt-1 text-gray-400">Beispiel: {info.example}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Separator className="bg-gray-100" />

            {/* Abschnitt 4: Einstellungen - Kompakte Switches */}
            <div className="space-y-3">
              <Label className="font-semibold text-gray-900 text-sm">Einstellungen</Label>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-medium text-gray-900 text-sm">Nur für mich sichtbar</span>
                    <p className="text-gray-500 text-xs">
                      Private Vorlage, andere Teammitglieder sehen sie nicht
                    </p>
                  </div>
                  <InfoTooltip content="Aktivieren Sie diese Option, wenn nur Sie diese Vorlage verwenden können sollen. Andere Benutzer Ihres Unternehmens sehen sie dann nicht." />
                </div>
                <Switch
                  checked={formData.isPrivate}
                  onCheckedChange={checked =>
                    setFormData(prev => ({ ...prev, isPrivate: checked }))
                  }
                  className="data-[state=checked]:bg-accent"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-medium text-gray-900 text-sm">
                      Als Standard festlegen
                    </span>
                    <p className="text-gray-500 text-xs">
                      Wird automatisch in neuen Dokumenten vorausgewählt
                    </p>
                  </div>
                  <InfoTooltip content="Wenn aktiviert, wird diese Vorlage automatisch ausgewählt, wenn Sie ein neues Dokument des entsprechenden Typs erstellen." />
                </div>
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={checked =>
                    setFormData(prev => ({ ...prev, isDefault: checked }))
                  }
                  className="data-[state=checked]:bg-accent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Kompakt */}
        <DialogFooter className="shrink-0 rounded-b-lg border-t bg-gray-50 px-6 py-4">
          <div className="flex w-full justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-gray-300 hover:bg-gray-100"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !formData.name.trim() || !formData.text.trim()}
              className="min-w-30 bg-accent text-white hover:bg-teal-700"
            >
              {loading && <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />}
              {template ? 'Speichern' : 'Erstellen'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
