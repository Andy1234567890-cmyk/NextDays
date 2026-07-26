// Eine an MICH gerichtete Co-Gastgeber-Einladung (Empfänger-Sicht).
import { api } from "./api-server";

import type { CohostAccess } from "./cohosts";

export interface PendingInvitation {
  id: string;
  property_id: string;
  property_title: string | null;
  access: CohostAccess;
  note: string | null;
  expires_at: string;
  inviter_name: string | null;
}

export interface CohostAssignment {
  id: string;
  property_id: string;
  property_title: string | null;
  access: CohostAccess;
  accepted_at: string | null;
}

/**
 * Einladung über ihren Token öffnen.
 *
 * Bewusst als öffentlicher Aufruf: Der Eingeladene hat womöglich noch kein
 * Konto und muss erst sehen, worum es geht. Der Token ist das Geheimnis.
 */
export async function getEinladung(token: string): Promise<PendingInvitation> {
  return api<PendingInvitation>(`/cohosts/invitation/${token}`, {
    public: true,
    cache: "no-store",
  });
}
