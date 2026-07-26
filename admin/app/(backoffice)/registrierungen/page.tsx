// Neuanmeldungen beider Welten — bewusst GETRENNT dargestellt.
//
// Die Trennung ist keine Darstellungsfrage, sondern Architektur (ADR-0015/0017):
//   • Betriebs-Nutzer (users)  = Supply-Seite, gehören zu einem Tenant.
//   • Plattform-Gäste (portal_guests) = Demand-Seite, KEIN Tenant, eigene
//     Auth-Welt. Beides zu vermischen würde die Mandantenlogik verschleiern.
import Link from "next/link";

import { getGuests, getUsers } from "@/lib/backoffice";

export default async function RegistrierungenSeite({
  searchParams,
}: {
  searchParams: Promise<{ welt?: string }>;
}) {
  const { welt } = await searchParams;
  const gaeste = welt === "gaeste";

  const [nutzer, gastListe] = await Promise.all([
    gaeste ? null : getUsers({ limit: 100 }),
    gaeste ? getGuests({ limit: 100 }) : null,
  ]);

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">
        Registrierungen
      </h1>

      <div className="mt-6 flex gap-2">
        <Link
          href="/registrierungen"
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            !gaeste
              ? "border-foreground bg-foreground text-background"
              : "border-border hover:border-foreground"
          }`}
        >
          Gastgeber
        </Link>
        <Link
          href="/registrierungen?welt=gaeste"
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            gaeste
              ? "border-foreground bg-foreground text-background"
              : "border-border hover:border-foreground"
          }`}
        >
          Plattform-Gäste
        </Link>
      </div>

      {!gaeste && nutzer && (
        <>
          <p className="mt-6 text-[0.9375rem] text-muted-foreground">
            {nutzer.total} Betriebs-Nutzer
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-semibold">Name</th>
                  <th className="pb-2 pr-4 font-semibold">E-Mail</th>
                  <th className="pb-2 pr-4 font-semibold">Betrieb</th>
                  <th className="pb-2 pr-4 font-semibold">Rolle</th>
                  <th className="pb-2 font-semibold">Registriert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {nutzer.items.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 pr-4 font-medium">{u.full_name ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {u.email ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {u.tenant_id ? (
                        <Link
                          href={`/betriebe/${u.tenant_id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {u.tenant_name ?? u.tenant_id}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {u.role ?? "—"}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {gaeste && gastListe && (
        <>
          <p className="mt-6 text-[0.9375rem] text-muted-foreground">
            {gastListe.total} Plattform-Gäste
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-semibold">Name</th>
                  <th className="pb-2 pr-4 font-semibold">E-Mail</th>
                  <th className="pb-2 pr-4 font-semibold">Sprache</th>
                  <th className="pb-2 pr-4 font-semibold">Werbung</th>
                  <th className="pb-2 font-semibold">Registriert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {gastListe.items.map((g) => (
                  <tr key={g.id}>
                    <td className="py-3 pr-4 font-medium">{g.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {g.email ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {g.preferred_locale ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {g.marketing_opt_in ? "Ja" : "Nein"}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(g.created_at).toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
