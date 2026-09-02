import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partner Program",
  description: "Recommend businesses, build a team, and earn a share of subscription revenue.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "How it works",
      articles: [
        {
          slug: "ueberblick",
          title: "Partner Program at a glance",
          excerpt: "Who can participate, how commission is generated, and what you see.",
          updated: "Status: September 2026",
          body: [
            {
              type: "p",
              text: "As a partner, you recommend myNextDays to landlords, agencies, and hotels. If a business registers with your code or via your link and pays its subscription invoices, you receive a share of the net subscription revenue for twelve months. The tier based on paying customers is live on the program page.",
            },
            { type: "h2", text: "Who can become a partner" },
            {
              type: "ul",
              items: [
                "Individuals and companies in the EU, Switzerland, or the United Kingdom with a genuine channel to hosts: influencers, consultants, agencies, tax firms, associations.",
                "Also myNextDays customers themselves — a subscription is not a prerequisite.",
                "Mandatory for application: at least one social media account (Instagram, TikTok, YouTube, Facebook, LinkedIn …) with address, handle, and reach. Website or newsletter gladly in addition.",
              ],
            },
            { type: "h2", text: "How a business is assigned to you" },
            {
              type: "steps",
              items: [
                "You share your link (mynextdays.com/p/YOUR-CODE) or your code.",
                "The business sees the code during registration in the \"Recommended by\" field and confirms it by submitting — without a cookie.",
                "The twelve-month period begins with the first paid subscription invoice.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "You see your customers pseudonymously (Customer #1, #2 …) with country, status, and amounts — never name or email. A business is assigned to exactly one partner; the first one wins.",
            },
            { type: "h2", text: "What you find in the dashboard" },
            {
              type: "ul",
              items: [
                "Overview: Rank, clicks, registered and paying businesses, open, payable, and paid commission.",
                "Commissions: each paid subscription invoice as a line with basis, rate, amount, and status.",
                "Payouts: monthly per currency from the minimum amount, with credit note (self-billing) as proof.",
                "Links & Material: your codes, promotional material, and the mandatory labeling per country.",
                "Messages: direct line to the partner team.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Build a team: team commission",
          excerpt: "Recruit partners who join with your code — and earn a share of their customers' revenue.",
          updated: "Status: September 2026",
          body: [
            {
              type: "p",
              text: "You can bring other partners into your team. If someone applies via your team link (mynextdays.com/p/YOUR-CODE?team=1) and visibly enters your code in the application, they will belong to your team after approval. You receive a team commission on the net subscription revenue of your team partners' customers.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "The team rate depends on YOUR rank at the time of payment — not on the size of your team. The rates are on the program page.",
                "Your rank is based only on your own paying customers. Team customers do not count for rank.",
                "Exactly one level: your team partners do not build their own team under you.",
                "No participation fee, no money for recruiting a partner. Team commission arises exclusively from paid subscription revenue.",
                "Twelve months from the first paid invoice of the respective team customer, 30-day refund window, reversal upon refund or chargeback — as with your own commission.",
                "Team commission is only generated when you and your team partner are approved; otherwise, it will be suspended.",
              ],
            },
            { type: "h2", text: "Team Evaluation" },
            {
              type: "p",
              text: "Under \"Team\", you will see each team partner with their rank, paying customers, subscription revenue from their customers (30 days and total), and your team commission from it—open, payable, paid—as well as the history of the last twelve months. You will not see customer details of your team partners; those belong to them.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Via \"Team\", you can reach your team partners directly by message—and your sponsor can reach you.",
            },
            {
              type: "note",
              variant: "warn",
              text: "The same email domain or bank details between sponsor and team partner will be marked and checked by the partner team before team commission is paid out.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Payout, Credit, and Taxes",
          excerpt: "When commission becomes payable, what the credit looks like, and what tax rules apply.",
          updated: "As of: September 2026",
          body: [
            {
              type: "steps",
              items: [
                "A commission line is created with the paid subscription invoice and is \"open\" for 30 days (refund window).",
                "After that, it is payable. On the first of the month, we bundle all payable lines per currency.",
                "If the sum exceeds the minimum amount for your currency, a payout with credit (self-billing) is generated. You do not need to issue an invoice.",
                "After the transfer, the payout will appear as \"Paid\" with a reference in the dashboard.",
              ],
            },
            {
              type: "ul",
              items: [
                "Companies: The credit note includes the reverse-charge remark; a confirmed VAT ID (VIES check) is required.",
                "Private individuals: The credit note does not show VAT; the commission is to be taxed by yourself.",
                "Payout via SEPA, Wise, or PayPal—you enter the data in your profile; changes require your password.",
                "No conversion: Commission in DKK will be paid out in DKK, commission in EUR in EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Advertising must be recognizable as such—at the beginning of the post, in the language of the post. The documented wordings per country can be found under \"Links & Material\". Violations can lead to suspension.",
            },
          ],
        },
      ],
    },
  ],
};
