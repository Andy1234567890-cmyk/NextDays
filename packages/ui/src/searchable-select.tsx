"use client";

// Durchsuchbares EINZEL-Select (Combobox) auf Basis von cmdk + Popover.
//
// WOFÜR (03.09.2026): Eigentümer wohnen weltweit — die Länderauswahl in den
// Eigentümer-Stammdaten zeigte nur die 27 EU-Staaten plus CH/UK, weil sie an
// `@nextdays/ui/countries` hing (jene Liste trägt die EU-Steuer-Labels und
// Telefonvorwahlen und ist dafür richtig). Eine Liste mit 194 Ländern in einem
// nativen `<select>` ist ohne Suche unbenutzbar: der Nutzer scrollt an
// „Simbabwe" vorbei, statt „sim" zu tippen.
//
// Das Gegenstück zu ``MultiSelect`` und absichtlich getrennt davon: dort ist
// „nichts gewählt" gleich „alle" und die Auswahl erscheint als Chips — hier ist
// „nichts gewählt" ein leerer Wert und die Auswahl EIN Eintrag. Beides in eine
// Komponente zu pressen hätte zwei Verhaltensmodelle in eine Datei gelegt.
//
// Auf Mobil bleibt es ein Popover mit Suchfeld statt eines nativen Rades: die
// Suche IST der Zweck, und ein `<select>` mit 194 Optionen wäre dort noch
// schlechter zu bedienen als am Schreibtisch.
import { Icon } from "@iconify/react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk";
import { useEffect, useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

export type SearchableOption = {
  value: string;
  label: string;
  /** Zusätzliche Treffertexte, die NICHT angezeigt werden — z. B. der
   *  ISO-Code („DK") oder der englische Name, damit „denmark" und „dk"
   *  dasselbe Land finden wie „Dänemark". */
  keywords?: string[];
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Auswählen …",
  searchPlaceholder = "Suchen …",
  emptyHint = "Keine Treffer.",
  clearLabel,
  disabled,
  className,
  id,
}: {
  options: SearchableOption[];
  /** Der gewählte Wert; leerer String = nichts gewählt. */
  value: string;
  /** Leerer String, wenn die Auswahl aufgehoben wird. */
  onChange: (next: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyHint?: string;
  /** Setzt einen „—"-Eintrag an den Anfang, der die Auswahl leert. Ohne diese
   *  Angabe ist die Auswahl nicht aufhebbar (Pflichtfeld). */
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [suche, setSuche] = useState("");
  const gewaehlt = options.find((o) => o.value === value);
  const eingabe = useRef<HTMLInputElement>(null);

  // Suchtext beim Öffnen leeren, nicht beim Schließen: sonst blitzt die
  // gefilterte Liste beim Zuklappen kurz auf die volle Liste um.
  useEffect(() => {
    if (open) setSuche("");
  }, [open]);

  function waehlen(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-(--radius) border border-border bg-background px-3 text-left text-sm transition-colors",
            "hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("truncate", !gewaehlt && "text-muted-foreground")}>
            {gewaehlt?.label ?? placeholder}
          </span>
          <Icon
            icon="ph:caret-down"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          // Fokus auf das Suchfeld, nicht auf den ersten Eintrag: tippen ist
          // der Zweck dieser Komponente.
          e.preventDefault();
          eingabe.current?.focus();
        }}
      >
        <Command className="flex max-h-72 flex-col" shouldFilter={false}>
          <CommandInput
            ref={eingabe}
            value={suche}
            onValueChange={setSuche}
            placeholder={searchPlaceholder}
            className="border-b border-border px-3 py-2 text-sm outline-none"
          />
          <CommandList className="overflow-y-auto p-1">
            <CommandEmpty className="px-3 py-4 text-center text-sm text-muted-foreground">
              {emptyHint}
            </CommandEmpty>
            <CommandGroup>
              {clearLabel !== undefined && suche.trim() === "" && (
                <CommandItem
                  value="__leeren__"
                  onSelect={() => waehlen("")}
                  className="cursor-pointer rounded-(--radius) px-2 py-1.5 text-sm text-muted-foreground data-[selected=true]:bg-secondary"
                >
                  {clearLabel}
                </CommandItem>
              )}
              {/* Eigene Filterung (`shouldFilter={false}`), weil cmdk nur den
                  `value` durchsucht: mit `keywords` findet „dk" und „denmark"
                  dasselbe Land wie „Dänemark". Ein Fuzzy-Score wäre hier
                  falsch — bei Ländernamen zählt der Präfix. */}
              {options
                .filter((o) => {
                  const q = suche.trim().toLocaleLowerCase();
                  if (!q) return true;
                  return [o.label, ...(o.keywords ?? [])].some((s) =>
                    s.toLocaleLowerCase().includes(q),
                  );
                })
                .map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.value}
                    onSelect={() => waehlen(o.value)}
                    className="flex cursor-pointer items-center gap-2 rounded-(--radius) px-2 py-1.5 text-sm data-[selected=true]:bg-secondary"
                  >
                    <Icon
                      icon="ph:check"
                      className={cn(
                        "size-4 shrink-0",
                        o.value === value ? "text-accent" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
