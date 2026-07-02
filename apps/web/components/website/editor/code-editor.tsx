"use client";

// Code-Editor (Framer „Edit Code"): ersetzt die Canvas-Mitte durch einen
// vollwertigen Editor — Breadcrumb oben (Seite → Datei.tsx), darunter
// CodeMirror mit Zeilennummern + TSX-Syntax-Highlighting. Klick auf den
// Seiten-Chip kehrt zur Canvas zurück; Änderungen werden live persistiert.
import { javascript } from "@codemirror/lang-javascript";
import { Icon } from "@iconify/react";
import CodeMirror from "@uiw/react-codemirror";
import { useState } from "react";

export function CodeEditorView({
  pageTitle,
  file,
  source,
  onChange,
  onBack,
}: {
  pageTitle: string;
  file: string;
  source: string;
  onChange: (src: string) => void;
  onBack: () => void;
}) {
  // Lokal editieren, jede Änderung sofort nach oben melden (Live-Persist).
  const [code, setCode] = useState(source);
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background">
      {/* Breadcrumb wie Framer: Seite (grau, klickbar = zurück) → Datei (aktiv). */}
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <Icon icon="ph:house" className="size-3.5" />
          {pageTitle}
        </button>
        <Icon icon="ph:caret-right" className="size-3 text-muted-foreground/60" />
        <span className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <Icon icon="ph:file-code" className="size-3.5" />
          {file}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeMirror
          value={code}
          height="100%"
          style={{ height: "100%" }}
          extensions={[javascript({ jsx: true, typescript: true })]}
          onChange={(v) => { setCode(v); onChange(v); }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            autocompletion: true,
          }}
          className="h-full text-[0.8125rem]"
        />
      </div>
    </div>
  );
}
