import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Kortetermijnverhuur en registratieplichten",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "In veel steden en regio's is het kortstondig verhuren van woonruimte vergunning-, registratie- of meldplichtig. Deze pagina legt uit wat dat betekent voor aanbieders en voor gasten.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Rechtskader",
      paragraphs: [
        "Verordening (EU) 2024/1028 betreffende gegevensverzameling en -uitwisseling in verband met diensten voor kortetermijnverhuur van accommodatie schept een uniform kader: waar een lidstaat of een decentrale overheid een registratieprocedure heeft ingevoerd, krijgt elke eenheid een registratienummer.",
        "Platforms moeten dat nummer tonen, de geldigheid ervan steekproefsgewijs controleren en de bevoegde instanties periodiek gegevens over de activiteit doorgeven.",
        "Daarnaast blijven nationale en plaatselijke voorschriften gelden — bijvoorbeeld over onttrekking van woonruimte, maximale verhuurdagen, brandveiligheid en registratie van gasten.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Wat aanbieders moeten doen",
      paragraphs: [
        "Ga vóór publicatie na of voor uw accommodatie een registratie-, vergunning- of meldplicht geldt, en voldoe daaraan.",
        "Voer het registratienummer in het object in wanneer er een bestaat. Wij tonen het in de advertentie.",
        "Neem maximale verhuurdagen en overige plaatselijke grenzen in acht. Het bewaken daarvan is uw taak, niet de onze.",
        "Wij mogen een advertentie zonder het vereiste registratienummer niet blijvend tonen. Ontbreekt het of blijkt het ongeldig, dan vragen wij het na; blijft de opgave uit, dan deactiveren wij de advertentie.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Wat dit betekent voor gasten",
      paragraphs: [
        "Geldt voor een accommodatie een registratieplicht, dan ziet u het registratienummer in de advertentie. Het is een aanwijzing dat de verhuur bij de bevoegde instantie is aangemeld.",
        "Op de bestemming kan een registratie vereist zijn (registratieformulier, identiteitsgegevens, verklaring toeristenbelasting). De aanbieder vraagt de nodige gegevens op; stel die tijdig ter beschikking.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Gegevensverstrekking aan instanties",
      paragraphs: [
        "Voor zover Verordening (EU) 2024/1028 of nationaal recht dat voorschrijft, verstrekken wij de bevoegde instanties gegevens over de verhuuractiviteit — met name registratienummer, adres van de eenheid, aantal bezette nachten en aantal gasten.",
        "Die verstrekking geschiedt ter nakoming van een wettelijke verplichting op grond van artikel 6, lid 1, onder c), van Verordening (EU) 2016/679. Bijzonderheden staan in de [Privacyverklaring](https://mybestdays.dk/rechtliches/datenschutz).",
        "Los daarvan bestaat de fiscale meldplicht op grond van DAC7; zie het [Belastingbeleid](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Schendingen melden",
      paragraphs: [
        "Hebt u aanwijzingen dat een accommodatie zonder de vereiste vergunning of registratie wordt aangeboden, meld het ons dan via de meldfunctie bij de advertentie. Wij gaan elke melding na.",
      ],
    },
  ],
};
