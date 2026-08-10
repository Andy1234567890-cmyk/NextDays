"use client";

// Nutzerliste im Konto → Benutzer: alle Tenant-Mitglieder mit Avatar, Name,
// Rolle und Zugangs-Status. Der Account-Inhaber steht zuerst (Backend-Sortierung).
//
// Die ganze Zeile ist ein Link auf die Detailseite (/konto/nutzer/<id>) — dort
// stehen Kontaktdaten, Zusatzinfos, Rechte und die Objektzuweisung, jeweils
// bearbeitbar. Deshalb liegen hier nur noch die Aktionen, die man aus der Liste
// heraus braucht: Zugang sperren/freigeben, Einladung erneut senden, löschen.
//
// Die Zuweisungs-Dialoge (Objekte zuordnen/freigeben) sind aus dieser Zeile
// entfallen: sie hatten hier keinen Zusammenhang zu dem, was zugewiesen IST.
// Auf der Detailseite steht die Zuweisung neben der Liste der zugewiesenen
// Objekte — dieselbe Aktion an der Stelle, an der man ihr Ergebnis sieht.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@nextdays/ui/avatar";
import { Button } from "@nextdays/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import {
  type TenantUser,
  type UserRole,
  activateManagedUser,
  deactivateManagedUser,
  deleteManagedUser,
} from "@/lib/account";
import { einladungErneutSenden } from "@/lib/einladung";
import { initialsOf } from "@/lib/initials";

import { ZugangsStatus } from "./zugangs-status";

// Rollen-Beschriftung: `owner` heißt im Kundentext „Unterkunftseigentümer"
// (roles.ownerShort), die übrigen tragen ihren eigenen Schlüssel.
function rollenSchluessel(role: UserRole): string {
  return role === "owner" ? "roles.ownerShort" : `roles.${role}`;
}

export function UserList({ users }: { users: TenantUser[] }) {
  const t = useTranslations("account");
  const router = useRouter();
  // Welcher Nutzer gerade eine laufende Aktion hat (null = keiner). Ein
  // gemeinsamer Zustand, damit nicht zwei Aktionen auf derselben Zeile
  // gleichzeitig laufen (Wurzel 2: Doppelklick).
  const [busyId, setBusyId] = useState<string | null>(null);

  async function einladungSenden(user: TenantUser) {
    setBusyId(user.user_id);
    const res = await einladungErneutSenden(user.user_id);
    setBusyId(null);
    // Die Adresse steht bewusst in der Meldung: der Betreiber soll sehen,
    // wohin die Mail ging (Tippfehler sind die häufigste Ursache).
    if (res.ok) {
      toast.success(t("users.inviteResent", { email: user.email ?? "" }));
    } else {
      toast.error(res.error || t("users.inviteResendFailed"));
    }
  }

  async function statusUmschalten(user: TenantUser) {
    const aktiv = user.is_active !== false;
    setBusyId(user.user_id);
    const res = aktiv
      ? await deactivateManagedUser(user.user_id)
      : await activateManagedUser(user.user_id);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // Weicht der Anmeldedienst ab, wird das gesagt — ein Teilerfolg darf nicht
    // wie „erledigt" aussehen (Wurzel 5).
    const wieGewuenscht = aktiv
      ? res.data.login_gesperrt
      : !res.data.login_gesperrt;
    if (wieGewuenscht) {
      toast.success(
        aktiv ? t("userDetail.deactivated") : t("userDetail.activated"),
      );
    } else {
      toast.warning(
        aktiv
          ? t("userDetail.deactivatedLoginPending")
          : t("userDetail.activatedLoginPending"),
      );
    }
    router.refresh();
  }

  async function loeschen(user: TenantUser) {
    const label = user.full_name || user.email || "";
    // Löschen ist endgültig (Login + Zuordnungen) → bewusst bestätigen lassen.
    // Wer nur vorübergehend sperren will, nimmt „Deaktivieren".
    if (!window.confirm(t("userDetail.confirmDelete", { name: label }))) return;
    setBusyId(user.user_id);
    const res = await deleteManagedUser(user.user_id);
    setBusyId(null);
    if (res.ok) {
      toast.success(t("users.deleted"));
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
      {users.map((user) => {
        const aktiv = user.is_active !== false;
        const busy = busyId === user.user_id;
        return (
          <li key={user.user_id} className="flex items-center gap-3 p-3">
            <Link
              href={`/konto/nutzer/${user.user_id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <Avatar>
                {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
                <AvatarFallback>
                  {initialsOf(user.full_name || user.email || "?")}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {user.full_name || user.email || t("userDetail.unnamed")}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.role ? t(rollenSchluessel(user.role)) : "—"}
                </span>
              </span>
            </Link>

            <ZugangsStatus aktiv={aktiv} seit={user.deactivated_at ?? null} />

            {/* Der Kontoinhaber (Admin) ist weder sperr- noch löschbar — das
                Backend erzwingt es ebenfalls. Ohne Aktionen kein Menü. */}
            {user.role !== "admin" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={t("userDetail.moreActions")}
                    disabled={busy}
                  >
                    <Icon
                      icon={busy ? "ph:spinner" : "ph:dots-three-vertical"}
                      className={"size-4 " + (busy ? "animate-spin" : "")}
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/konto/nutzer/${user.user_id}`}>
                      <Icon icon="ph:pencil-simple" />
                      {t("users.edit")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => void statusUmschalten(user)}
                  >
                    <Icon icon={aktiv ? "ph:prohibit" : "ph:check-circle"} />
                    {aktiv
                      ? t("userDetail.deactivate")
                      : t("userDetail.activate")}
                  </DropdownMenuItem>
                  {/* Einladung erneut senden (Mail kam nicht an).
                      Steht bewusst bei JEDEM Nutzer und nicht nur bei den noch
                      nicht aktivierten: `TenantUser` trägt kein Feld, an dem
                      sich „noch nicht angenommen" ablesen ließe. Einen
                      Aktivierungs-Status zu RATEN wäre eine erfundene Aussage
                      (Wurzel 4). Ob erneut gesendet werden DARF, entscheidet
                      ohnehin der Server (er lehnt einen aktiven Zugang ab). */}
                  <DropdownMenuItem onSelect={() => void einladungSenden(user)}>
                    <Icon icon="ph:envelope-simple" />
                    {t("users.resendInvite")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => void loeschen(user)}
                  >
                    <Icon icon="ph:trash" />
                    {t("users.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        );
      })}
    </ul>
  );
}
