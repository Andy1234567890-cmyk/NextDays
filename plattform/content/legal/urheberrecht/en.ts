import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Copyright Policy",
  stand: "Last updated: 18 August 2026",
  intro: [
    "myBestDays respects the rights of others and expects its users to do the same. This policy sets out how to report a copyright infringement and how we deal with it.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principle",
      paragraphs: [
        "Anyone posting content on the Platform warrants that they hold the necessary rights. This applies in particular to photos, floor plans, texts and map extracts in listings.",
        "Posting third-party content without permission is a breach of the [Terms of Service](https://mybestdays.dk/rechtliches/nutzungsbedingungen) and of the [Content Policy](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Reporting an infringement",
      paragraphs: [
        "Report a copyright infringement using the reporting function on the content concerned or via the point of contact set out under [Digital Services Act](https://mybestdays.dk/rechtliches/dsa). A notice should contain:",
      ],
      list: [
        "a precise identification of the content complained of, in particular the URL;",
        "a description of the protected work and evidence of your ownership of rights or of your authority to act for the rightholder;",
        "an explanation of why the use is not permitted;",
        "your name and a contact address;",
        "a statement that your information is accurate and complete to the best of your knowledge.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. How we handle notices",
      paragraphs: [
        "We confirm receipt of your notice without delay and decide promptly and diligently.",
        "If we consider the notice well founded we remove the content or disable access to it and inform the person who posted it, stating the reasons and the complaint route.",
        "If we consider the notice unfounded we inform you with reasons.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Objection by the person concerned",
      paragraphs: [
        "If your content has been removed and you consider that unjustified, you may complain free of charge within six months. Explain why you are entitled to the use.",
        "If the complaint proves well founded, we restore the content.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Repeat infringements",
      paragraphs: [
        "Accounts through which infringing content is repeatedly posted are suspended after a prior warning. This corresponds to Article 23 of Regulation (EU) 2022/2065.",
        "Likewise we suspend the reporting function for persons who repeatedly submit manifestly unfounded notices.",
      ],
    },
  ],
};
