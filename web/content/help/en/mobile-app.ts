import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobile App",
  description: "The myNextDays app for on the go.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "App",
      articles: [
        {
          slug: "die-app",
          title: "The myNextDays app",
          excerpt: "One account, four experiences: guest, agency, owner, and staff.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "The myNextDays app is the mobile platform for your entire operation. It is not a separate product, but an equal frontend to your web dashboard — both access the same account and the same data, only the interface is optimized for use on the go.",
            },
            { type: "h2", text: "Four experiences in one app" },
            {
              type: "ul",
              items: [
                "Guest: view bookings, communicate with the property, retrieve check-in information.",
                "Agency: manage multiple properties and units at a glance.",
                "Owner: read-only insight into your own properties, occupancy, and reports.",
                "Staff: calendar, tasks, and cleaning schedules for day-to-day operations.",
              ],
            },
            { type: "h2", text: "Which experience you see" },
            {
              type: "p",
              text: "After signing in, the app automatically shows the experience that matches your role — the same role that applies in the web dashboard. A staff member with restricted rights sees exactly the same restrictions in the app as in the browser, since the permission is checked server-side.",
            },
            {
              type: "note",
              variant: "info",
              text: "For more on roles and what each may see, refer to [Roles & permissions](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "You do not need a separate registration for the app — simply sign in with your existing myNextDays credentials.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Install the app & sign in",
          excerpt: "How to download the myNextDays app and sign in.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "The myNextDays app is available for iOS and Android. Sign-in uses the same credentials as the web dashboard — no separate account and no new registration are required.",
            },
            { type: "h2", text: "Installation" },
            {
              type: "steps",
              items: [
                "Open the App Store (iOS) or Google Play (Android).",
                "Search for “myNextDays.”",
                "Install the app on your smartphone or tablet.",
                "Open the app after installation.",
              ],
            },
            { type: "h2", text: "Signing in" },
            {
              type: "steps",
              items: [
                "Tap “Sign in.”",
                "Enter your email address and password.",
                "Confirm the two-factor prompt if requested.",
                "You are automatically taken to the experience that matches your role.",
              ],
            },
            {
              type: "ul",
              items: [
                "Credentials are identical to the web dashboard.",
                "If your access has been revoked, sign-in in the app is blocked immediately as well.",
                "For password issues, use “Forgot password” directly in the app.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sign in only through the official “myNextDays” app store listing; the app never asks for credentials outside the sign-in screen.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Manage on the go",
          excerpt: "Handle bookings, messages, and tasks directly from your smartphone.",
          updated: "Last updated: July 2026",
          body: [
            {
              type: "p",
              text: "The myNextDays app is especially suited for running day-to-day operations on the go: you see current bookings, reply to guest messages, and work through tasks without needing to sit at a computer — changes appear in real time in the web dashboard as well.",
            },
            { type: "h2", text: "Bookings at a glance" },
            {
              type: "p",
              text: "In the “Bookings” section you see arrivals and departures, occupancy, and status per property. Staff and cleaning roles see only the information relevant to them, without prices or sales details.",
            },
            { type: "h2", text: "Messages & tasks" },
            {
              type: "steps",
              items: [
                "Open the “Messages” section to reply to guest inquiries directly.",
                "Switch to “Tasks” to see the to-dos assigned to you.",
                "Tap a task to open its details and complete it.",
                "Mark completed cleaning appointments as done right on site.",
              ],
            },
            {
              type: "ul",
              items: [
                "New messages and tasks appear live, without manual refreshing.",
                "Completed tasks are immediately visible in the web dashboard as well.",
                "Owners see bookings and reports for their properties, but strictly read-only.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Push notifications inform you about new messages and assigned tasks as soon as you allow them in your device settings.",
            },
          ],
        },
      ],
    },
  ],
};
