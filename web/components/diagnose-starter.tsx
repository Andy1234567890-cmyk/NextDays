"use client";

// Startet den technischen Fehler-Reporter.
//
// Erfasst standardmäßig NUR Fehler und fehlgeschlagene Backend-Aufrufe — keine
// Klickpfade, keine Eingaben, keine Bildschirminhalte. Der Bedienablauf kommt
// ausschließlich dazu, solange der Kunde eine Debug-Freigabe erteilt hat
// (Konto → Support-Diagnose); erst dann sieht der Support überhaupt etwas.
import { installDiagnostics } from "@nextdays/diagnostics";
import { useEffect } from "react";

export function DiagnoseStarter() {
  useEffect(() => {
    installDiagnostics({
      app: "web",
      endpoint: "/api/diagnose",
      // Aufrufe über 8 s gelten als langsam — darunter ist es normales Rauschen.
      slowMs: 8000,
      // Läuft eine Freigabe, wird der Bedienablauf nach jedem Seitenaufbau
      // wieder aufgezeichnet — sonst endete sie stillschweigend beim ersten F5.
      freigabeAktiv: async () => {
        const res = await fetch("/api/diagnose", { cache: "no-store" });
        if (!res.ok) return false;
        return ((await res.json()) as { aktiv?: boolean }).aktiv === true;
      },
    });
  }, []);
  return null;
}
