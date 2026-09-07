// CRM-Einstieg: die erste Fläche ist die Akquise (Leads). Der Sidebar-Punkt
// zeigt auf /crm; die Reiter sind echte Pfade (/crm/leads, /crm/partner).
import { redirect } from "next/navigation";

export default function CrmPage() {
  redirect("/crm/leads");
}
