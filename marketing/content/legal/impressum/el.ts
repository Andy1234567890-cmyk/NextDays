// Ελληνική μετάφραση των νομικών πληροφοριών. Η έκδοση αναφοράς είναι
// ./de.ts — οι ουσιαστικές αλλαγές γίνονται ΠΡΩΤΑ εκεί, μετά εδώ.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Νομικές πληροφορίες",
  metaDescription:
    "Στοιχεία παρόχου της myNextDays ApS σύμφωνα με το § 7 του δανικού νόμου περί ηλεκτρονικού εμπορίου (e-handelslov): εταιρεία, διεύθυνση, διοίκηση, αριθμός CVR και στοιχεία επικοινωνίας.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Στοιχεία σχετικά με τον πάροχο της πλατφόρμας myNextDays — ενός property management system και channel manager που λειτουργεί η ${ANBIETER.firma}.`,
    "Υποχρεωτικές πληροφορίες σύμφωνα με το § 7 του δανικού νόμου περί ηλεκτρονικού εμπορίου (e-handelslov), ο οποίος ενσωματώνει το άρθρο 5 της οδηγίας 2000/31/ΕΚ για το ηλεκτρονικό εμπόριο.",
  ],
  sections: [
    {
      heading: "Πάροχος",
      zeilen: [
        {
          label: "Εταιρεία",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Διεύθυνση",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Νόμιμη εκπροσώπηση/διοίκηση",
          werte: [`${ANBIETER.direktion.join(" και ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Επικοινωνία",
      zeilen: [
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Τηλέφωνο",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Ιστότοπος",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Εμπορικό μητρώο και ΦΠΑ",
      zeilen: [
        {
          label: "Εμπορικό μητρώο",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Δανία",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Αριθμός φορολογικού μητρώου ΦΠΑ",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Σημείο επικοινωνίας βάσει της νομοθεσίας για τις ψηφιακές υπηρεσίες",
      paragraphs: [
        `Κεντρικό σημείο επικοινωνίας για τις αρχές βάσει του άρθρου 11 και για τους χρήστες βάσει του άρθρου 12 του κανονισμού (ΕΕ) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
        "Οι γλώσσες επικοινωνίας είναι τα γερμανικά, τα δανικά και τα αγγλικά.",
      ],
    },
    {
      heading: "Επίλυση καταναλωτικών διαφορών",
      paragraphs: [
        "Δεν είμαστε ούτε πρόθυμοι ούτε υποχρεωμένοι να συμμετάσχουμε σε διαδικασία επίλυσης διαφορών ενώπιον φορέα καταναλωτικής διαμεσολάβησης.",
      ],
    },
    {
      heading: "Ευθύνη για συνδέσμους",
      paragraphs: [
        "Παρά τον προσεκτικό έλεγχο περιεχομένου, δεν αναλαμβάνουμε καμία ευθύνη για το περιεχόμενο εξωτερικών συνδέσμων. Για το περιεχόμενο των συνδεδεμένων σελίδων υπεύθυνοι είναι αποκλειστικά οι αντίστοιχοι φορείς εκμετάλλευσής τους.",
      ],
    },
    {
      heading: "Πνευματικά δικαιώματα",
      paragraphs: [
        `Το περιεχόμενο, τα κείμενα, τα γραφικά και τα εμπορικά σήματα που δημοσιεύονται σε αυτόν τον ιστότοπο προστατεύονται από το δίκαιο πνευματικής ιδιοκτησίας και σημάτων. Οποιαδήποτε χρήση πέραν των νομίμως επιτρεπόμενων περιπτώσεων απαιτεί την προηγούμενη έγγραφη συναίνεση της ${ANBIETER.firma}.`,
      ],
    },
    {
      heading: "Λοιπά νομικά έγγραφα",
      paragraphs: [
        "Η χρήση της πλατφόρμας διέπεται από τους Γενικούς Όρους Συναλλαγών μας. Ο τρόπος επεξεργασίας των δεδομένων προσωπικού χαρακτήρα περιγράφεται στην Πολιτική Απορρήτου· τα cookies που χρησιμοποιούνται αναφέρονται στην Πολιτική Cookies.",
      ],
      links: [
        { label: "Γενικοί Όροι Συναλλαγών", href: AGB_URL },
        { label: "Πολιτική Απορρήτου", href: "/datenschutz" },
        { label: "Πολιτική Cookies", href: "/cookie-richtlinie" },
        { label: "Σύμβαση Επεξεργασίας Δεδομένων (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Εφαρμοστέο δίκαιο",
      paragraphs: [
        `Η ${ANBIETER.firma} έχει την έδρα της και είναι εγκατεστημένη αποκλειστικά στη Δανία. Ως εκ τούτου, για αυτήν την ηλεκτρονική προσφορά ισχύει το δανικό δίκαιο — ακόμη και για την ελληνική γλωσσική έκδοση (αρχή της χώρας καταγωγής σύμφωνα με το άρθρο 3 της οδηγίας 2000/31/ΕΚ). Οι υποχρεώσεις ενημέρωσης διέπονται από το § 7 του δανικού νόμου περί ηλεκτρονικού εμπορίου (e-handelslov).`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
