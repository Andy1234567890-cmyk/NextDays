'use client';

import { Icon } from '@iconify/react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
} from '@tasko/ui';
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
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import TextTemplateModal from '@/components/settings/TextTemplateModal';
import PlaceholderModal from '@/components/texteditor/PlaceholderModal';

import { TextTemplateService } from '@/services/TextTemplateService';
import type { TextTemplate } from '@/types/textTemplates';

interface FooterTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  companyId?: string;
  userId?: string;
  objectType?: 'INVOICE' | 'QUOTE' | 'REMINDER' | 'CREDIT_NOTE' | 'CANCELLATION';
  textType?: 'HEAD' | 'FOOT';
  onTemplateSelect?: (templateId: string) => void;
}

// Leichter TipTap-Editor speziell für Fuß-Text mit Basisformatierung und Platzhaltern
export default function FooterTextEditor({
  value,
  onChange,
  className,
  companyId,
  userId,
  objectType,
  textType,
  onTemplateSelect,
}: FooterTextEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [textTemplates, setTextTemplates] = useState<TextTemplate[]>([]);
  const [placeholderModalOpen, setPlaceholderModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TextTemplate | null>(null);

  useEffect(() => setMounted(true), []);

  // Textvorlagen laden
  const loadTextTemplates = async () => {
    if (!companyId) return;
    try {
      // Debug

      // Erst Standard-Templates erstellen falls keine vorhanden
      await TextTemplateService.createDefaultTemplatesIfNeeded(companyId, companyId);

      let templates: TextTemplate[] = [];

      // Erst versuchen mit spezifischen Filtern
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

      // Falls immer noch keine, alle für company laden
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
      console.error('Fehler beim Laden der Textvorlagen:', error);
    }
  };

  useEffect(() => {
    // Nur einmal nach Mount laden. loadTextTemplates ist bei jedem Render eine
    // neue Funktion — als Dependency würde sie eine Render-Endlosschleife auslösen.
    if (mounted) {
      loadTextTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, companyId, objectType, textType]);

  // 🆕 Separater Effect für Auto-Template-Ladung beim objectType-Wechsel
  useEffect(() => {
    if (mounted && textTemplates.length > 0 && objectType) {
      // Suche nach FOOT-Template für den objectType
      const footTemplate = textTemplates.find(
        t =>
          t.objectType === objectType &&
          t.textType === 'FOOT' &&
          (t.isDefault ||
            textTemplates.filter(tt => tt.objectType === objectType && tt.textType === 'FOOT')
              .length === 1),
      );

      if (footTemplate) {
        // Prüfe ob das aktuelle Value ein Standard-Template von einem anderen Typ ist
        const isEmptyOrWrongType =
          !value ||
          value.trim() === '' ||
          value === '<p></p>' ||
          // 🔥 AGGRESSIV: Ersetze auch bekannte falsche Dokument-Texte
          (objectType === 'REMINDER' &&
            (value.includes('Rechnungsbetrag') || value.includes('freundlichen Grüßen'))) ||
          (objectType === 'CREDIT_NOTE' &&
            (value.includes('Mahnungsbetrag') || value.includes('Rechnungsbetrag'))) ||
          (objectType === 'CANCELLATION' &&
            (value.includes('Mahnungsbetrag') || value.includes('Rechnungsbetrag'))) ||
          (objectType === 'INVOICE' && value.includes('Mahnungsbetrag'));

        if (isEmptyOrWrongType && footTemplate.text !== value) {
          onChange(footTemplate.text || '');
          setSelectedTemplate(footTemplate);
        }
      } else {
      }
    }
  }, [objectType, textTemplates, mounted, onChange, value]); // Nur auf objectType und textTemplates ändern reagieren

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
          Editor wird geladen…
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
      toast.error(`Fehler: ${!companyId ? 'companyId' : 'userId'} fehlt`);
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
            <DropdownMenuLabel>Schriftgröße</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().run()}>
              <span>Standard (12)</span>
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
          className={`h-8 px-2 ${editor.isActive('bold') ? 'bg-accent text-white' : 'hover:bg-accent/10'}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Fett (Cmd + B)"
        >
          <Icon icon="lucide:bold" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('italic') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive('italic') ? 'bg-accent text-white' : 'hover:bg-accent/10'}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Kursiv (Cmd + I)"
        >
          <Icon icon="lucide:italic" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('underline') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive('underline') ? 'bg-accent text-white' : 'hover:bg-accent/10'}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Unterstreichen (Cmd + U)"
        >
          <Icon icon="lucide:underline" className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Durchgestrichen */}
        <Button
          type="button"
          variant={editor.isActive('strike') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive('strike') ? 'bg-accent text-white' : 'hover:bg-accent/10'}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Durchgestrichen"
        >
          <Icon icon="lucide:strikethrough" className="h-4 w-4" />
        </Button>

        {/* Farbe */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="Farbe">
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
              ].map(color => (
                <button
                  key={color}
                  aria-label={`Farbe ${color}`}
                  className="h-6 w-6 rounded border border-gray-300"
                  style={{ backgroundColor: color }}
                  onClick={() => editor.chain().focus().setColor(color).run()}
                />
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Listen */}
        <Button
          type="button"
          variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive('orderedList') ? 'bg-accent text-white' : 'hover:bg-accent/10'}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Nummerierte Liste (Cmd + /)"
        >
          <Icon icon="lucide:list-ordered" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive('bulletList') ? 'bg-accent text-white' : 'hover:bg-accent/10'}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Stichpunkte (Cmd + .)"
        >
          <Icon icon="lucide:list" className="h-4 w-4" />
        </Button>

        {/* Tabelle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="Tabelle">
              <Icon icon="lucide:table" className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
            >
              Tabelle einfügen (3x3)
            </DropdownMenuItem>
            {editor.isActive('table') && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => editor.chain().focus().deleteTable().run()}>
                  Tabelle entfernen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()}>
                  Zeile oberhalb einfügen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                  Zeile unterhalb einfügen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                  Zeile löschen
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Link */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => {
            const url = window.prompt('Link URL:');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          title="Link"
        >
          <Icon icon="lucide:link" className="h-4 w-4" />
        </Button>

        {/* Trennlinie */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Trennlinie"
        >
          <Icon icon="lucide:minus" className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Textausrichtung */}
        <Button
          type="button"
          variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive({ textAlign: 'left' }) ? 'bg-accent text-white' : 'hover:bg-accent/10'}`}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Linksbündig"
        >
          <Icon icon="lucide:align-left" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive({ textAlign: 'center' }) ? 'bg-accent text-white' : 'hover:bg-accent/10'}`}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Zentriert"
        >
          <Icon icon="lucide:align-center" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 px-2 ${editor.isActive({ textAlign: 'right' }) ? 'bg-accent text-white' : 'hover:bg-accent/10'}`}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Rechtsbündig"
        >
          <Icon icon="lucide:align-right" className="h-4 w-4" />
        </Button>

        {/* Einzug */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => editor.chain().focus().liftListItem('listItem').run()}
          title="Einzug verkleinern"
        >
          <Icon icon="lucide:outdent" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
          title="Einzug vergrößern"
        >
          <Icon icon="lucide:indent" className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Textvorlagen-Button - immer anzeigen */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-8 px-3 ${selectedTemplate ? 'selected bg-accent text-white' : 'hover:bg-accent/10'}`}
              title="Textvorlage"
            >
              <span className="select-none">Textvorlage</span>
              <span className="caret ml-1" style={{ fontSize: '9pt' }}>
                ▼
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Textvorlagen</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {companyId && objectType && textTemplates.length > 0 ? (
              <>
                {textTemplates.map(template => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => insertTemplate(template)}
                    className="flex items-center justify-between"
                  >
                    <span>{template.name}</span>
                    {template.isDefault && <span className="text-accent text-xs">Standard</span>}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-accent"
                  onClick={() => setTemplateModalOpen(true)}
                >
                  <Icon icon="lucide:plus" className="mr-2 h-4 w-4" />
                  Textvorlage erstellen
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem disabled className="text-gray-500">
                Keine Textvorlagen verfügbar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Platzhalter-Button direkt daneben */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-3"
          onClick={() => setPlaceholderModalOpen(true)}
          title="Platzhalter"
        >
          <span className="select-none">Platzhalter</span>
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

      {/* Textvorlage Erstellen Modal */}
      {companyId && userId && (
        <TextTemplateModal
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
