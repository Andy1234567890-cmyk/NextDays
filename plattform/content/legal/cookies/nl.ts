import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Cookiebeleid",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "Dit beleid legt uit welke cookies en vergelijkbare technieken myBestDays inzet, waarvoor, hoelang zij worden bewaard en hoe u ze beheert.",
    "Het vult de [Privacyverklaring](https://mybestdays.dk/rechtliches/datenschutz) aan.",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Wat cookies zijn",
      paragraphs: [
        "Cookies zijn kleine tekstbestanden die een website in uw browser opslaat. Vergelijkbare technieken zijn de lokale opslag van de browser en telpixels in e-mails.",
        "Cookies die strikt noodzakelijk zijn voor de werking van het platform mogen wij zonder uw toestemming plaatsen. Voor alle overige vragen wij uw toestemming (artikel 5, lid 3, van Richtlijn 2002/58/EG).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Noodzakelijke cookies",
      paragraphs: [
        "Deze cookies zijn nodig voor de werking en kunnen niet worden uitgeschakeld. Wij plaatsen momenteel:",
      ],
      list: [
        "„nd_access“ — houdt u aangemeld. Alleen voor de server leesbaar (HttpOnly), levensduur overeenkomstig de geldigheid van de sessie.",
        "„nd_refresh“ — vernieuwt uw aanmelding zodat u niet steeds opnieuw hoeft in te loggen. Alleen voor de server leesbaar, levensduur 30 dagen.",
        "„nd_gast_locale“ — onthoudt uw gekozen taal. Levensduur één jaar.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Functionele, statistische en marketingcookies",
      paragraphs: [
        "myBestDays plaatst momenteel geen cookies voor statistiek, bereikmeting of reclame en sluit geen advertentienetwerken of analysediensten in.",
        "Mocht dat veranderen, dan vragen wij vooraf uw toestemming via een keuzedialoog waarin weigeren even eenvoudig is als instemmen, en vullen wij dit beleid aan met de concrete cookies.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Ingesloten inhoud van derden",
      paragraphs: [
        "Op detailpagina's kunnen kaarten zijn ingesloten. Dergelijke inhoud laden wij pas wanneer u die uitdrukkelijk activeert; pas dan kunnen gegevens naar de betreffende aanbieder worden verzonden.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Hoe u cookies beheert",
      paragraphs: [
        "Uw toestemming kunt u te allen tijde via de cookie-instellingen in de voettekst wijzigen of intrekken.",
        "Daarnaast kunt u cookies in uw browser verwijderen of blokkeren. Verwijdert u de noodzakelijke cookies, dan wordt u afgemeld en werkt het platform beperkt.",
      ],
    },
  ],
};
