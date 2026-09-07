"use client";

// Suchfeld des Hilfe-Centers. Schickt die Frage an /hilfe/suche — die Suche
// selbst laeuft serverseitig ueber den Inhaltsindex.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function HilfeSuchfeld({ start = "" }: { start?: string }) {
  const router = useRouter();
  const [frage, setFrage] = useState(start);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = frage.trim();
        if (q) router.push(`/hilfe/suche?q=${encodeURIComponent(q)}`);
      }}
      className="flex items-center gap-2 rounded-full border border-border px-4 py-3 focus-within:border-foreground"
    >
      <Icon icon="ph:magnifying-glass" className="size-5 shrink-0 opacity-60" />
      <input
        type="search"
        value={frage}
        onChange={(e) => setFrage(e.target.value)}
        placeholder="Wonach suchst du?"
        className="w-full bg-transparent outline-none"
      />
    </form>
  );
}
