"use client";

// postMessage-Brücke zwischen Draft-iframe (builder/) und Editor (apps/web):
// - Klick auf einen Block im Canvas → meldet dessen Index an den Editor
//   (der den passenden Block selektiert).
// - Hover → Outline.
// Der Editor-Origin wird vom Editor selbst beim Mounten via "canvas:hello"
// gesetzt; Nachrichten gehen nur an diesen Origin (kein Wildcard-Leak).
import { useEffect } from "react";

export function CanvasBridge() {
  useEffect(() => {
    let parentOrigin: string | null = null;

    function send(type: string, payload: Record<string, unknown>) {
      if (!parentOrigin) return;
      window.parent.postMessage({ source: "builder-canvas", type, ...payload }, parentOrigin);
    }

    function blockIndexFrom(target: EventTarget | null): number | null {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        const idx = el.getAttribute?.("data-block-index");
        if (idx != null) return Number(idx);
        el = el.parentElement;
      }
      return null;
    }

    function onClick(e: MouseEvent) {
      const idx = blockIndexFrom(e.target);
      if (idx != null) {
        e.preventDefault();
        send("select", { index: idx });
      }
    }

    function onMessage(e: MessageEvent) {
      const data = e.data as { source?: string; type?: string } | null;
      if (data?.source === "builder-editor" && data.type === "hello") {
        parentOrigin = e.origin; // Editor stellt sich vor → Ziel-Origin merken
        send("ready", {});
      }
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onMessage);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
