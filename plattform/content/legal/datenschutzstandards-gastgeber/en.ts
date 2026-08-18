import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Host Privacy Standards",
  stand: "Last updated: 18 August 2026",
  intro: [
    "When you offer accommodation via myBestDays you receive personal data of your guests. For processing that data you are an independent controller within the meaning of Regulation (EU) 2016/679 (GDPR). These standards set out what we expect of you.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Purpose limitation",
      paragraphs: [
        "You use guest data solely to perform the booking, to communicate with the guest and to comply with your statutory obligations (such as registration forms, tourist tax, tax and retention obligations).",
        "Any further use — in particular advertising, newsletters, disclosure to third parties, inclusion in your own guest database for later direct bookings — requires its own legal basis, generally the guest's consent.",
        "You do not use guest data to induce the guest to book outside the Platform.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Data minimisation",
      paragraphs: [
        "You collect only the data you actually need. You request copies of identity documents only where a legal provision requires it, and retain them only for as long as that provision provides.",
        "You do not request payment data. Payments run via the Platform.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Security",
      paragraphs: [
        "You protect guest data by appropriate technical and organisational measures — access only for persons who need the data, protected devices, encrypted transmission.",
        "If you engage staff, cleaners or co-hosts, you place them under a duty of confidentiality and give them only the data they need for their task.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Retention and deletion",
      paragraphs: [
        "You delete guest data as soon as the purpose has ceased and no retention obligation remains.",
        "You retain registration forms and tax-relevant records for as long as the law of your country requires — no longer.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Guests' rights",
      paragraphs: [
        "If a guest approaches you with a request for access, rectification, erasure or objection, you answer it within the applicable deadline. If it concerns data held by us, refer them to us.",
        "You inform your guests how you process their data, to the extent you go beyond performing the booking.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Personal data breaches",
      paragraphs: [
        "If a breach of the protection of guest data occurs, you notify the competent supervisory authority without delay and, where required, the guests concerned.",
        "Where the breach concerns data you received via the Platform, you also inform us so that we can assess our own obligations.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Cameras and recording devices",
      paragraphs: [
        "In interior spaces with a legitimate expectation of privacy — bedrooms, bathrooms — cameras and microphones are not permitted, even when switched off.",
        "All other cameras, motion detectors with recording, video doorbells and noise sensors must be disclosed in the listing, stating their location and what is recorded.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Consequences of breaches",
      paragraphs: [
        "We treat breaches of these standards as breaches of the [Additional Terms for Hosts](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) and may take measures up to suspension of the account.",
      ],
    },
  ],
};
