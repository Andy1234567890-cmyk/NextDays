import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Team & Permissions",
  description: "Staff, roles, and access rights.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Access",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Inviting staff",
          excerpt: "How to invite new staff to your myNextDays account.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "You can invite any number of staff members to your business — for example for reception, cleaning, or administration. Each invitation is tied to an email address and immediately assigns a fixed role that determines access in the web dashboard and the myNextDays app.",
            },
            { type: "h2", text: "Sending an invitation" },
            {
              type: "steps",
              items: [
                "Open “Account” and switch to the “Team” section.",
                "Click “Invite staff.”",
                "Enter the person's email address.",
                "Select the appropriate role, e.g. Staff or Cleaning.",
                "Confirm the invitation.",
              ],
            },
            { type: "h2", text: "What happens next" },
            {
              type: "p",
              text: "The invited person receives an email with a link to set their own password and log in. The login works equally for the web dashboard and the myNextDays app — there is no separate account per frontend.",
            },
            {
              type: "ul",
              items: [
                "An invitation remains valid until it is accepted or withdrawn.",
                "You can see open invitations in the “Team” section with the status “Pending.”",
                "The role can be changed at any time afterward.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "To learn which role can see which areas, see [Roles & Permissions](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Assign the narrowest fitting role from the start — permissions can always be expanded later.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Roles & Permissions",
          excerpt: "The five roles in myNextDays and what each one is allowed to do.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "myNextDays distinguishes five roles: Admin, Co-Admin, Staff, Cleaning, and Owner. Each role determines which areas are visible in the web dashboard and the myNextDays app — permissions are enforced on the server side, not just hidden in the interface.",
            },
            { type: "h2", text: "The roles at a glance" },
            {
              type: "ul",
              items: [
                "Admin: full access to all areas, including finances, sales, and team management.",
                "Co-Admin: nearly full access like Admin, for the business's second management level.",
                "Staff: operational access to bookings, the calendar, and tasks, without insight into finances or sales.",
                "Cleaning: access only to assigned cleaning tasks and property details, without insight into finances or sales.",
                "Owner: read-only insight into their own properties, no management of other properties.",
              ],
            },
            { type: "h2", text: "Assigning or changing a role" },
            {
              type: "steps",
              items: [
                "Open “Account” → “Team.”",
                "Select the relevant staff member from the list.",
                "Click “Change role.”",
                "Select the new role and confirm.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Staff and Cleaning never see prices, revenue, or booking channels — this restriction is enforced on the server side and cannot be bypassed through the interface.",
            },
            {
              type: "note",
              variant: "info",
              text: "You can find an overview by role under [What each role sees](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "What each role sees",
          excerpt: "Specific areas and views per role in the web dashboard and the app.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "In addition to the general permissions described in [Roles & Permissions](/hilfe/team-rollen/rollen-berechtigungen), a closer look at individual areas helps you set the right expectations when onboarding new staff.",
            },
            { type: "h2", text: "Calendar & bookings" },
            {
              type: "p",
              text: "Admin, Co-Admin, and Staff see the full occupancy schedule with guest data and tasks. Cleaning sees only the appointments assigned to them, including the property address and checklist, but no guest names or prices. Owners see the occupancy calendar only for their own properties, in read-only mode.",
            },
            { type: "h2", text: "Finances & sales" },
            {
              type: "ul",
              items: [
                "Revenue, commissions, and invoices: Admin and Co-Admin only.",
                "Portals (OTA connection) and marketplace visibility: Admin and Co-Admin only.",
                "Staff and Cleaning: no access to finance or sales areas, including detail pages.",
              ],
            },
            { type: "h2", text: "Team & settings" },
            {
              type: "p",
              text: "Managing staff, roles, and account settings remains reserved for Admin and Co-Admin. Owners and operational roles do not see this area at all, either in the myNextDays app or the web dashboard.",
            },
            {
              type: "note",
              variant: "info",
              text: "This split applies identically in the web dashboard and the myNextDays app, since both frontends query the same role from your account.",
            },
            {
              type: "note",
              variant: "tip",
              text: "After inviting a new team member, briefly test their new role together to avoid misunderstandings about which areas are visible.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Revoking access",
          excerpt: "Remove staff access immediately and completely.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "If a staff member leaves your business or the working relationship changes, remove their access directly in the account. Revocation takes effect on the server side immediately — not only after an existing session expires.",
            },
            { type: "h2", text: "Removing access" },
            {
              type: "steps",
              items: [
                "Open “Account” → “Team.”",
                "Select the relevant staff member.",
                "Click “Revoke access.”",
                "Confirm the action.",
              ],
            },
            { type: "h2", text: "Effect on active sessions" },
            {
              type: "p",
              text: "After revocation, the person can no longer log in to either the web dashboard or the myNextDays app. You should reassign any already-assigned tasks or cleaning appointments to another staff member beforehand so nothing is left unhandled.",
            },
            {
              type: "ul",
              items: [
                "Reassign open tasks before revoking access.",
                "Access can be restored later by sending a new invitation.",
                "Revocation only affects this business, not any other accounts the person may have.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Revoke access promptly as soon as a working relationship ends — open staff accounts otherwise remain an unnecessary security risk.",
            },
          ],
        },
      ],
    },
  ],
};
