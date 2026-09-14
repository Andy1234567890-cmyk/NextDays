'use client';

import { Icon } from '@iconify/react';
import { Button, Separator } from '@tasko/ui';
import { Color } from '@tiptap/extension-color';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@nextdays/ui/dropdown-menu';
import TextvorlageDialog from '@/components/finance/textvorlage-dialog';
import PlaceholderModal from '@/components/texteditor/PlaceholderModal';

import { TextTemplateService } from '@/services/TextTemplateService';
import type { TextTemplate } from '@/types/textTemplates';

interface HeaderTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  companyId?: string;
  userId?: string;
  objectType?: 'INVOICE' | 'QUOTE' | 'REMINDER' | 'CREDIT_NOTE' | 'CANCELLATION';
  textType?: 'HEAD' | 'FOOT';
  onTemplateSelect?: (templateId: string) => void;
}

// TipTap-Editor speziell für Kopf-Text mit Basisformatierung und Platzhaltern
export default function HeaderTextEditor({
  value,
  onChange,
  className,
  companyId,
  userId,
  objectType,
  textType = 'HEAD', // Default auf HEAD für Header-Text
  onTemplateSelect,
}: HeaderTextEditorProps) {
  const t = useTranslations('finance');
  const [mounted, setMounted] = useState(false);
  const [textTemplates, setTextTemplates] = useState<TextTemplate[]>([]);
  const [placeholderModalOpen, setPlaceholderModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TextTemplate | null>(null);

  useEffect(() => setMounted(true), []);

  // Textvorlagen laden - speziell für Header-Text
  const loadTextTemplates = async () => {
    if (!companyId) return;
    try {
      // Debug

      // Erst Standard-Templates erstellen falls keine vorhanden
      await TextTemplateService.createDefaultTemplatesIfNeeded(companyId, companyId);

      let templates: TextTemplate[] = [];

      // Erst versuchen mit spezifischen Filtern für HEAD-Text
      if (objectType && textType) {
        templates = await TextTemplateService.getTextTemplatesByType(
          companyId,
          objectType,
          textType,
        );
      }

      // Falls keine gefunden, alle für objectType laden
      if (templates.length === 0 && objectType) {
        templates = await TextTemplateService.getTextTemplatesByType(companyId, objectType);
      }

      // Falls immer noch keine, alle für company laden und filtern
      if (templates.length === 0) {
        const allTemplates = await TextTemplateService.getTextTemplates(companyId);
        templates = allTemplates.filter(
          t =>
            (!objectType || t.objectType === objectType) && (!textType || t.textType === textType),
        );
      }

      setTextTemplates(templates);

      // Templates sind geladen - der separate useEffect wird die Auto-Ladung handhaben

      // Debug
    } catch (error) {
      console.error('Fehler beim Laden der Kopftext-Vorlagen:', error);
    }
  };

  useEffect(() => {
    // Nur einmal nach Mount laden. loadTextTemplates ist bei jedem Render eine
    // neue Funktion — als Dependency würde sie eine Render-Endlosschleife auslösen.
    if (mounted) {
      loadTextTemplates();
      // Wer im Nebentab eine Vorlage anlegt und zurückwechselt, sieht sie sofort.
      const beiFokus = () => void loadTextTemplates();
      window.addEventListener('focus', beiFokus);
      return () => window.removeEventListener('focus', beiFokus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, companyId, objectType, textType]);

  // 🆕 Auto-Template-Ladung beim objectType-Wechsel
  useEffect(() => {
    if (mounted && textTemplates.length > 0 && objectType) {
      // Suche nach HEAD-Template für den objectType (bevorzuge Standard-Template)
      let headTemplate = textTemplates.find(
        t => t.objectType === objectType && t.textType === 'HEAD' && t.isDefault,
      );

      // Falls kein Standard-Template, nimm das erste verfügbare HEAD-Template
      if (!headTemplate) {
        headTemplate = textTemplates.find(
          t => t.objectType === objectType && t.textType === 'HEAD',
        );
      }

      if (headTemplate) {
        const currentValue = value || '';

        // Prüfe ob automatische Template-Ladung erforderlich ist
        const isEmptyOrWrongType =
          currentValue.trim() === '' ||
          currentValue === '<p></p>' ||
          // REMINDER sollte nicht Invoice-Texte haben
          (objectType === 'REMINDER' &&
            (currentValue.includes(
              'Hiermit stelle ich Ihnen die folgenden Leistungen in Rechnung',
            ) ||
              currentValue.includes('vielen Dank für Ihren Auftrag') ||
              currentValue.includes('Rechnungsstellung'))) ||
          // INVOICE sollte nicht Reminder-Texte haben
          (objectType === 'INVOICE' &&
            (currentValue.includes(
              'sicherlich haben Sie unsere Rechnung in Ihrem Postfach übersehen',
            ) ||
              currentValue.includes('ausstehenden Forderungen'))) ||
          // Andere Dokumenttypen
          (objectType === 'CREDIT_NOTE' &&
            currentValue.includes(
              'Hiermit stelle ich Ihnen die folgenden Leistungen in Rechnung',
            )) ||
          (objectType === 'CANCELLATION' &&
            currentValue.includes('Hiermit stelle ich Ihnen die folgenden Leistungen in Rechnung'));

        if (isEmptyOrWrongType && headTemplate.text && headTemplate.text !== currentValue) {
          onChange(headTemplate.text);
          setSelectedTemplate(headTemplate);
        }
      }
    }
  }, [objectType, textTemplates, mounted, value, onChange]); // value hinzugefügt für bessere Reaktivität

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Exclude built-in Link to avoid conflicts
        link: false,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],

    content: value || '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-35 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent bg-white',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!mounted || !editor) {
    return (
      <div className={className}>
        <div className="min-h-35 rounded-md border p-3 text-gray-400 text-sm">
          {t('HeaderTextEditor.loading')}
        </div>
      </div>
    );
  }

  const _insertPlaceholder = (token: string) => {
    editor.chain().focus().insertContent(token).run();
  };

  const insertPlaceholders = (tokens: string[]) => {
    const content = tokens.join(' ');
    editor.chain().focus().insertContent(content).run();
  };

  const insertTemplate = (template: TextTemplate) => {
    editor.chain().focus().setContent(template.text).run();
    onChange(template.text);
    setSelectedTemplate(template);
    if (onTemplateSelect) {
      onTemplateSelect(template.id);
    }
  };

  const handleSaveTemplate = async (
    templateData: Omit<TextTemplate, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    if (!companyId || !userId) {
      toast.error(
        t('HeaderTextEditor.missingField', {
          field: !companyId ? 'companyId' : 'userId',
        }),
      );
      return;
    }
    // Ensure companyId and createdBy are in the template data
    const fullTemplateData: Omit<TextTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
      ...templateData,
      companyId,
      createdBy: userId,
    };

    await TextTemplateService.createTextTemplate(fullTemplateData);
    // Template-Liste neu laden
    await loadTextTemplates();
  };

  return (
    <div className={className}>
      <style jsx>{`
        .toolbar-item {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 4px;
          text-decoration: none;
          user-select: none;
          cursor: pointer;
          font-size: 12px;
        }
        .toolbar-item.selected {
          background-color: var(--accent);
          color: white;
        }
        .caret {
          margin-left: 4px;
          font-size: 9pt;
        }
      `}</style>
      <div className="flex flex-wrap items-center gap-1 rounded-t-md border bg-gray-50 p-2">
        {/* Schriftgröße */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 min-w-13">
              12
              <Icon icon="lucide:chevron-down" className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>{t('HeaderTextEditor.fontSize')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().run()}>
              <span>{t('HeaderTextEditor.fontSizeDefault')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {[10, 11, 13, 14, 16, 18].map(size => (
              <DropdownMenuItem key={size} onClick={() => editor.chain().focus().run()}>
                <span>{size}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Basis-Formatierung */}
        <Button
          type="button"
          variant={editor.isActive('bold') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive('bold') ? 'bg-accent text-white' : 'hover:bg-accent/10 hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title={t('HeaderTextEditor.bold')}
        >
          <Icon icon="lucide:bold" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('italic') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive('italic') ? 'bg-accent text-white' : 'hover:bg-accent/10 hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title={t('HeaderTextEditor.italic')}
        >
          <Icon icon="lucide:italic" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('underline') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive('underline') ? 'bg-accent text-white' : 'hover:bg-accent/10 hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title={t('HeaderTextEditor.underline')}
        >
          <Icon icon="lucide:underline" className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Durchgestrichen */}
        <Button
          type="button"
          variant={editor.isActive('strike') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive('strike') ? 'bg-accent text-white' : 'hover:bg-accent/10 hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title={t('HeaderTextEditor.strikethrough')}
        >
          <Icon icon="lucide:strikethrough" className="h-4 w-4" />
        </Button>

        {/* Farbe */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              title={t('HeaderTextEditor.color')}
            >
              <Icon icon="lucide:palette" className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <div className="grid grid-cols-4 gap-1 p-2">
              {[
                '#000000',
                '#ff0000',
                '#00ff00',
                '#0000ff',
                '#ffff00',
                '#ff00ff',
                '#00ffff',
                '#808080',
                '#800000',
                '#008000',
                '#000080',
                '#808000',
                '#800080',
                '#008080',
                '#c0c0c0',
                '#ffffff',
              ].map(color => (
                <button
                  key={color}
                  type="button"
                  className="h-6 w-6 cursor-pointer rounded border border-gray-300"
                  style={{ backgroundColor: color }}
                  onClick={() => editor.chain().focus().setColor(color).run()}
                  title={color}
                />
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Textausrichtung */}
        <Button
          type="button"
          variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive({ textAlign: 'left' }) ? 'bg-accent text-white' : 'hover:bg-accent/10 hover:text-foreground'}`}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title={t('HeaderTextEditor.alignLeft')}
        >
          <Icon icon="lucide:align-left" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive({ textAlign: 'center' }) ? 'bg-accent text-white' : 'hover:bg-accent/10 hover:text-foreground'}`}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title={t('HeaderTextEditor.alignCenter')}
        >
          <Icon icon="lucide:align-center" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive({ textAlign: 'right' }) ? 'bg-accent text-white' : 'hover:bg-accent/10 hover:text-foreground'}`}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title={t('HeaderTextEditor.alignRight')}
        >
          <Icon icon="lucide:align-right" className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Listen */}
        <Button
          type="button"
          variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive('bulletList') ? 'bg-accent text-white' : 'hover:bg-accent/10 hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title={t('HeaderTextEditor.bulletList')}
        >
          <Icon icon="lucide:list" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive('orderedList') ? 'bg-accent text-white' : 'hover:bg-accent/10 hover:text-foreground'}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title={t('HeaderTextEditor.orderedList')}
        >
          <Icon icon="lucide:list-ordered" className="h-4 w-4" />
        </Button>

        {/* Einrückung */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => editor.chain().focus().liftListItem('listItem').run()}
          title={t('HeaderTextEditor.indentDecrease')}
        >
          <Icon icon="lucide:outdent" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
          title={t('HeaderTextEditor.indentIncrease')}
        >
          <Icon icon="lucide:indent" className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Kopftext-Vorlagen */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-8 px-3 ${selectedTemplate ? 'selected bg-accent text-white' : 'hover:bg-accent/10 hover:text-foreground'}`}
              title={t('HeaderTextEditor.headerTemplate')}
            >
              <span className="select-none">{t('HeaderTextEditor.headerTemplate')}</span>
              <span className="caret ml-1" style={{ fontSize: '9pt' }}>
                ▼
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t('HeaderTextEditor.headerTemplatesLabel')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {textTemplates.length > 0 ? (
              textTemplates.map(template => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => insertTemplate(template)}
                  className="flex items-center justify-between"
                >
                  <span>{template.name}</span>
                  {template.isDefault && (
                    <span className="text-accent text-xs">{t('HeaderTextEditor.default')}</span>
                  )}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled className="text-gray-500">
                {t('HeaderTextEditor.noHeaderTemplates')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-accent" onSelect={() => setTemplateModalOpen(true)}>
              <Icon icon="lucide:plus" className="mr-2 h-4 w-4" />
              {t('HeaderTextEditor.createHeaderTemplate')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Platzhalter-Button direkt daneben */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-3"
          onClick={() => setPlaceholderModalOpen(true)}
          title={t('HeaderTextEditor.placeholder')}
        >
          <span className="select-none">{t('HeaderTextEditor.placeholder')}</span>
          <span className="caret ml-1" style={{ fontSize: '9pt' }}>
            ▼
          </span>
        </Button>
      </div>

      <div className="rounded-b-md border border-t-0">
        <EditorContent
          editor={editor}
          className="prose min-h-30 max-w-none p-4 focus-within:outline-none [&_.ProseMirror]:min-h-30 [&_.ProseMirror]:p-0 [&_.ProseMirror]:outline-none"
        />
      </div>

      {/* Platzhalter Modal */}
      <PlaceholderModal
        isOpen={placeholderModalOpen}
        onClose={() => setPlaceholderModalOpen(false)}
        onInsert={insertPlaceholders}
        objectType={objectType}
      />

      {/* Kopftext-Vorlage Erstellen Modal */}
      {companyId && userId && (
        <TextvorlageDialog
          objectType={objectType}
          textType={textType}
          isOpen={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          onSave={handleSaveTemplate}
          companyId={companyId}
          userId={userId}
        />
      )}
    </div>
  );
}
