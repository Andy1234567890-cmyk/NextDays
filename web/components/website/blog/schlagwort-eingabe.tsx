"use client";

// Die Schlagwort-Eingabe — übernommen aus dem Agentur-CMS
// (`cms/apps/admin/src/components/TagsInput.tsx`).
//
// Angepasst: Symbol aus Iconify statt `lucide-react`, Beschriftung aus
// `next-intl`, und der Wert ist eine LISTE statt eines Komma-Strings — unser
// `site_pages.tags` ist ein `text[]`, das Vorbild speichert einen String.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";

type Props = {
  id?: string;
  value: string[];
  placeholder?: string;
  onChange: (value: string[]) => void;
};

export function SchlagwortEingabe({ id, value, placeholder, onChange }: Props) {
  const t = useTranslations("website");
  const [draft, setDraft] = useState("");
  const tags = value;

  const commit = (raw: string) => {
    const next = raw.trim();
    if (!next) return;
    // Duplikate (case-insensitiv) vermeiden.
    if (tags.some((t) => t.toLowerCase() === next.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...tags, next]);
    setDraft('');
  };

  const removeAt = (i: number) => {
    onChange(tags.filter((_, idx) => idx !== i));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      // leeres Feld + Backspace → letzten Tag entfernen
      removeAt(tags.length - 1);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-(--radius) border border-border bg-transparent px-2 py-1.5 focus-within:border-(--brand)">
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
        >
          {tag}
          <button
            type="button"
            aria-label={`${tag} ${t("blog.tag.removeTag")}`}
            onClick={() => removeAt(i)}
            className="inline-flex h-4 w-4 items-center justify-center rounded-sm hover:bg-foreground/10"
          >
            <Icon icon="ph:x" className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={tags.length === 0 ? (placeholder ?? t("blog.tag.tagPlaceholder")) : ''}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}
