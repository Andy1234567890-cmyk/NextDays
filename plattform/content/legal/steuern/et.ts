import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Maksupoliitika",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Käesolev leht selgitab, millised maksud ja lõivud võivad myBestDays kaudu broneerimisel tekkida, kes neid tasub ja millised teatamiskohustused on meil platvormi käitajana.",
    "See ei ole maksunõustamine. Oma maksukäsitluse osas konkreetsel juhul pöörduge maksunõustaja poole.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Mis puudutab külalisi",
      paragraphs: [
        "Kuvatav kogumaksumus sisaldab makse, mis arvestatakse Platvormi kaudu – eelkõige majutusteenuse käibemaksu, kui pakkuja seda tasuma peab.",
        "Kohalikke lõive nagu kuurordimaks, voodimaks või turismilõiv kogutakse olenevalt omavalitsusest kas Platvormi kaudu või kohapeal. Kumb juhtum kehtib, toome välja enne broneeringu lõpetamist.",
        "Arve majutusteenuse kohta väljastab pakkuja; tema on teenust osutav ettevõtja. Kui vajate käibemaksuga arvet, nõudke seda pakkujalt.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Mis puudutab pakkujaid",
      paragraphs: [
        "Pakkujad vastutavad ise oma tulude õige maksustamise eest – tulu- või ettevõtte tulumaks, käibemaks ja kohalikud lõivud.",
        "Kas üürile andmine on käibemaksuga maksustatav ja milline määr kohaldub, sõltub selle riigi õigusest, kus majutuskoht asub (teenuse osutamise koht kinnisasjade puhul).",
        "Pakkujad sisestavad oma majutuskohale kohalduvad lõivud objekti juurde, et need kuulutuses õigesti kuvataks.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Teatamine maksuhaldurile (DAC7)",
      paragraphs: [
        "Digiplatvormi käitajana oleme direktiivi (EL) 2021/514 („DAC7“) ja seda üle võtvate siseriiklike sätete kohaselt kohustatud igal aastal teatama pädevale maksuhaldurile andmed teatatavate pakkujate ja nende Platvormi kaudu saadud tasude kohta.",
        "Teatatakse eelkõige nimi, aadress, maksukohustuslasena registreerimise number, sünnikuupäev või registrikood, konto andmed väljamakseks, majutuskoha aadress ning kvartalite kaupa makstud tasud ja kinni peetud tasud.",
        "Pakkujad saavad koopia neid puudutavatest teatatud andmetest.",
        "Kui pakkuja ei esita teatamiseks vajalikke andmeid vaatamata kahekordsele nõudele, oleme kohustatud väljamakseid kinni pidama ja konto blokeerima.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Kinnipidamised",
      paragraphs: [
        "Kui mõne riigi õigus kohustab meid väljamaksest makse kinni pidama ja üle kandma, teeme seda ja toome kinnipidamise arvestuses välja.",
      ],
    },
  ],
};
