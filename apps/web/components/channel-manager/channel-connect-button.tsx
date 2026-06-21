"use client";

// "Kanäle verbinden"-Button: holt die white-label Connect-URL vom Backend und
// öffnet die eingebettete Channel-Manager-Oberfläche (iFrame, Deutsch) in einem
// Vollbild-Overlay. Der Kunde sieht keinen Provider-Namen.
import { Icon } from "@iconify/react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { getChannelConnectUrl } from "@/lib/channex";

export function ChannelConnectButton({
  label = "Kanäle verbinden",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline" | "accent";
}) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    startTransition(async () => {
      const res = await getChannelConnectUrl();
      if (res.ok) {
        setUrl(res.data.url);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button type="button" variant={variant} onClick={open} disabled={pending}>
          <Icon
            icon={pending ? "ph:spinner" : "ph:plugs-connected"}
            className={"size-4 " + (pending ? "animate-spin" : "")}
          />
          {pending ? "Wird geöffnet …" : label}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {url && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-display text-lg font-bold">
              Kanäle verbinden
            </span>
            <button
              type="button"
              onClick={() => setUrl(null)}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm hover:bg-secondary"
            >
              <Icon icon="ph:x" className="size-4" />
              Schließen
            </button>
          </div>
          <iframe
            src={url}
            title="Kanäle verbinden"
            className="flex-1 border-0"
            allow="clipboard-write"
          />
        </div>
      )}
    </>
  );
}
