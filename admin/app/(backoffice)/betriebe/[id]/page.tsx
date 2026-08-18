// Detailsicht eines Betriebs. Dieser Aufruf wird mit tenant_id protokolliert —
// er ist der Vorgang, bei dem ein Betreiber in die Daten EINES Betriebs schaut.
import Link from "next/link";
import { notFound } from "next/navigation";

import { BetriebSperre } from "@/components/betrieb-sperre";
import { ApiError } from "@/lib/api-server";
import {
  getPlatformMe,
  getTenant,
  getUsers,
  getVorgaenge,
} from "@/lib/backoffice";

// Quelle als Badge — Farbe allein wäre ein WCAG-1.4.1-Verstoß, daher Text.
const QUELLE_LABEL: Record<string, string> = {
  reservierung: "Buchung",
  stornierung: "Storno",
  anmeldung: "Login",
  zuweisung: "Zuweisung",
};

export default async function BetriebSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let betrieb;
  try {
    betrieb = await getTenant(id);
  } catch (exc) {
    if (exc instanceof ApiError && exc.status === 404) notFound();
    throw exc;
  }
  const [me, nutzer, vorgaenge] = await Promise.all([
    getPlatformMe(),
    getUsers({ tenantId: id, limit: 100 }),
    // Fachliche Historie aus bestehenden Protokollen — nichts wird
    // zusätzlich aufgezeichnet, nur zusammengeführt.
    getVorgaenge(id).catch(() => ({ items: [] })),
  ]);

  const zeilen: { label: string; wert: string }[] = [
    { label: "Land", wert: betrieb.country ?? "—" },
    { label: "Währung", wert: betrieb.currency ?? "—" },
    { label: "Kontotyp", wert: betrieb.account_type ?? "—" },
    { label: "Betriebsart", wert: betrieb.business_type ?? "—" },
    {
      label: "Angelegt",
      wert: new Date(betrieb.created_at).toLocaleString("de-DE"),
    },
    {
      label: "Objekte",
      wert: `${betrieb.active_property_count} aktiv von ${betrieb.property_count}`,
    },
    {
      label: "Zahlungen freigeschaltet",
      wert: betrieb.stripe_charges_enabled ? "Ja" : "Nein",
    },
    { label: "Stripe-Konto", wert: betrieb.stripe_account_id ?? "—" },
    { label: "Abo-Status", wert: betrieb.subscription_status ?? "—" },
  ];

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <Link
        href="/betriebe"
        className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Betriebe
      </Link>
      <h1 className="mt-4 font-sans text-[2rem] font-bold tracking-tight">
        {betrieb.name}
      </h1>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{betrieb.id}</p>

      <div className="mt-8 max-w-2xl divide-y divide-border rounded-2xl border border-border">
        {zeilen.map((z) => (
          <div
            key={z.label}
            className="flex items-baseline justify-between gap-4 px-5 py-3.5"
          >
            <span className="text-sm text-muted-foreground">{z.label}</span>
            <span className="text-sm font-medium">{z.wert}</span>
          </div>
        ))}
      </div>

      <BetriebSperre
        tenantId={betrieb.id}
        name={betrieb.name}
        gesperrtSeit={betrieb.deactivated_at}
        grund={betrieb.deactivation_reason}
        darfEntscheiden={me.can_write}
      />

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Nutzer ({nutzer.total})
        </h2>
        {nutzer.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Keine Nutzer.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {nutzer.items.map((u) => (
              <li
                key={u.id}
                className="flex items-baseline justify-between gap-4 px-5 py-3.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">{u.full_name ?? "—"}</span>
                  <span className="text-muted-foreground"> · {u.email ?? "—"}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {u.role ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Vorgänge ({vorgaenge.items.length})
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Buchungen, Stornierungen, Anmeldungen und Zuweisungen — aus den
          bestehenden Protokollen des Betriebs.
        </p>
        {vorgaenge.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Keine Vorgänge.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {vorgaenge.items.map((v, i) => (
              <li
                key={`${v.quelle}-${v.created_at}-${i}`}
                className="flex items-start gap-4 px-5 py-3.5"
              >
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                  {QUELLE_LABEL[v.quelle] ?? v.quelle}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {v.beschreibung}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {v.user_email ?? v.user_id ?? "System"}
                    {v.detail.grund ? ` · ${String(v.detail.grund)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleString("de-DE")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
