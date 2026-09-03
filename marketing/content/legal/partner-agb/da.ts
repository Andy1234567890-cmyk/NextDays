// Partner-AGB — Dänisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Deltagelsesbetingelser for myNextDays-partnerprogrammet: Attribution, provisionsgrundlag, niveau, teamprovision, forbud, mærkning, udbetaling.",
  numbered: false,
  toc: true,
  title: "Deltagelsesbetingelser partnerprogram (Partner-AB) — Udkast",
  standIso: "2026-09-02",
  intro: [
    "UDKAST — Disse betingelser er et arbejdsudkast fra myNextDays og er endnu ikke juridisk gennemgået. Indtil den gennemgåede version er frigivet, gælder de som en beskrivelse af programmet, ikke som en endelig kontrakttekst. Den gennemgåede version vil blive offentliggjort på denne adresse med et nyt versionsnummer; partnere vil blive bedt om at give fornyet samtykke ved næste login.",
    `Disse deltagelsesbetingelser regulerer deltagelsen i partnerprogrammet (affiliate-programmet) for ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (i det følgende benævnt "myNextDays" eller "vi") af partnere (i det følgende benævnt "partner").`,
    "Partnerprogrammet henvender sig til personer og virksomheder med hjemsted i EU, Schweiz eller Storbritannien, der anbefaler virksomheder (udlejere, bureauer, hoteller) på myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Deltagelse og godkendelse",
      paragraphs: [
        "Deltagelse kræver en ansøgning via partner-dashboardet. Obligatoriske oplysninger er navn eller firmanavn, retsform, land, mindst én social medie-konto med adresse, handle og rækkevidde samt for virksomheder momsregistreringsnummeret.",
        "myNextDays gennemgår hver ansøgning personligt og træffer frit beslutning om godkendelse. Der er ingen ret til optagelse. Deltagelse er gratis; et abonnement på myNextDays er ikke en forudsætning.",
        "Partneren holder sine oplysninger ajour, især kanaler, retsform, skatte- og udbetalingsdata.",
        "Den angivne rækkevidde er i første omgang en selvangivelse. Partneren kan frivilligt forbinde sine konti på YouTube, Instagram, Facebook og TikTok; derefter læses følgere og visninger fra platformen og angives som verificerede. Ikke-verificeret rækkevidde vægtes lavere ved godkendelse og ved senere kontroller. Forbindelsen kan til enhver tid afbrydes i dashboardet; detaljer om behandlingen findes i databeskyttelseserklæringen.",
      ],
    },
    {
      heading: "§ 2 Tildeling af virksomheder (Attribution)",
      paragraphs: [
        "En virksomhed tildeles partneren, hvis den registrerer sig med partnerens anbefalingskode. Koden vises tydeligt for virksomheden ved registreringen og bekræftes ved afsendelse. Tracking-cookies sættes ikke.",
        "En virksomhed tildeles præcis én partner; den kode, der bekræftes ved registreringen, er afgørende. En senere omfordeling sker kun af myNextDays ved påvist fejl.",
        "Virksomheder, der tilhører partneren selv, dennes partnere, medarbejdere eller pårørende, samt virksomheder, der allerede er eller har været kunder hos myNextDays, tildeles ikke.",
      ],
    },
    {
      heading: "§ 3 Provision på egne kunder",
      paragraphs: [
        "Provisionsgrundlaget er den netto-abonnementsomsætning for den tildelte virksomhed (grundtarif og moduler) fra betalte fakturaer – uden moms, uden portalprovisioner, tillægsydelser, efterberegninger og andre gennemgående poster.",
        "Provisionssatsen afhænger af partnerens rang på betalingstidspunktet. Ranger og satser er offentliggjort på programsiden. Rangen bestemmes af antallet af betalende kunder i partnerens struktur: hans egne betalende kunder og hans team-partneres betalende kunder (§ 4), hver kunde én gang. Rangen fastsættes månedligt på skæringsdatoen; en oprykning gælder straks, en nedrykning først, når antallet har ligget under tærsklen på to på hinanden følgende skæringsdatoer.",
        "Opnår partneren for første gang en rang fra \"Aufsteiger\", modtager han en engangsoprykningsbonus, der er angivet for denne rang på programsiden (i øjeblikket 50,00 EUR pr. rang, for alle partnere i Euro). Hver rang honoreres kun én gang, også efter nedrykning og fornyet oprykning. Bonussen er omfattet af refusionsvinduet i henhold til § 7.",
        "Provisionen opstår pr. virksomhed i tolv måneder fra dennes første betalingspligtige abonnementsfaktura; en gratis prøveperiode og en gratismåned formidlet via partneren tæller ikke med. Ophører abonnementet tidligere, ophører provisionen med den sidste betalte faktura.",
        "Fra rangen \"Elite-Partner\" modtager partneren desuden en superprovision i den på programsiden angivne højde (i øjeblikket 2,5 %) af netto-abonnementsomsætningen fra alle kunder i hans struktur – egne kunder og kunder hos hans team-partnere – uden grænsen på tolv måneder, så længe den pågældende kunde har et betalende abonnement, og partneren har rangen på betalingstidspunktet. Den opstår ud over provisionen i henhold til sætning 2 og § 4.",
        "Fra rangen \"Elite-Partner\" modtager partneren for hver booking, der modtages og betales via myBestDays for en virksomhed, der er tilknyttet ham eller en af dennes team-partnere, en bookingandel i den på programsiden angivne højde (i øjeblikket 0,5 %) af det af gæsten betalte bookingbeløb i bookingvalutaen, uden tidsbegrænsning, så længe tilknytningen består, og partneren har rangen på tidspunktet for bookingbetalingen. Depositum er ikke et bookingbeløb. Refusioner til gæsten reducerer andelen forholdsmæssigt (§ 7).",
      ],
    },
    {
      heading: "§ 4 Team-provision",
      paragraphs: [
        "Fra rangen \"Aufsteiger\" må en partner lede team-partnere. Ansøger en anden partner via partnerens team-link og bekræfter dennes kode synligt i sin ansøgning, tildeles denne efter godkendelse partnerens team (i det følgende \"Sponsor\"). Har sponsoren ikke rangen på ansøgningstidspunktet, forbliver ansøgningen gyldig, men der opstår ingen team-tildeling.",
        "Sponsoren modtager en team-provision på netto-abonnementsomsætningen fra sine team-partneres kunder i en højde af forskellen mellem sin egen provisionssats og team-partnerens provisionssats, hver især i henhold til rangen på betalingstidspunktet. Står begge i samme rang, eller team-partneren højere, opstår der ingen team-provision. Team-partnerens provision og sponsorens team-provision overstiger tilsammen aldrig den højeste sats i staffelen (i øjeblikket 30 %).",
        "Teamprovisionen erlægges kun én niveau dybt: Team-partnere modtager ikke teamprovision på partnere, de selv rekrutterer. Der udbetales ingen godtgørelse for rekruttering af en partner; der opkræves intet deltagergebyr. Teamprovisionen stammer udelukkende fra betalt abonnementsomsætning.",
        "Teamprovisionen løber i tolv måneder pr. teamkunde fra dennes første betalte faktura, er underlagt samme refusionsperiode og reduceres forholdsmæssigt ved refusion eller tilbageførsel (§ 7). Den opstår kun, så længe sponsor og team-partner er godkendt; i modsat fald tilbageholdes den indtil afklaring.",
        "Teamtildelingen er engangs. En ændring foretages kun af myNextDays med dokumenteret årsag.",
      ],
    },
    {
      heading: "§ 5 Partnerens forpligtelser og mærkning",
      paragraphs: [
        "Partneren mærker enhver anbefaling med sit link eller sin kode som reklame – i begyndelsen af indlægget, på indlæggets sprog, i overensstemmelse med bestemmelserne i sit land (i Tyskland bl.a. § 5a, stk. 4 UWG, i Danmark markedsføringsloven § 6, stk. 4). Ordlyd pr. land stilles til rådighed af myNextDays i partner-dashboardet.",
        "Partneren giver kun oplysninger om myNextDays, der stemmer overens med de offentliggjorte ydelsesbeskrivelser, og afgiver ingen løfter på vegne af myNextDays. Især er succes- og garantiløfter (f.eks. „garanteret fuld belægning på tre dage“) samt udsagn om indtægter, der ikke følger af de offentliggjorte ydelsesbeskrivelser, forbudt.",
        "Hver video og hvert indlæg, der nævner myNextDays eller bærer partnerens link, skal indsendes som fil i partner-dashboardet til gennemgang før offentliggørelse. Partnerens link opstår først efter skriftlig godkendelse fra myNextDays; offentliggørelse uden godkendelse er forbudt. myNextDays kan tilbagekalde en godkendelse; allerede optjente provisioner forbliver uberørte.",
        "Til logoer, skærmbilleder, B-roll, overlays og screenshots anvender partneren udelukkende det af myNextDays leverede reklamemateriale. Egne, ikke-gennemgåede softwareoptagelser er ikke tilladt.",
      ],
    },
    {
      heading: "§ 6 Forbudte praksisser",
      paragraphs: ["Især er følgende forbudt:"],
      list: [
        "Brand-Bidding: betalte annoncer på mærket „myNextDays“, stavevarianter og kombinationer (f.eks. „myNextDays priser“) i søgemaskiner og netværk;",
        "Cookie-dropping, skjulte viderestillinger, iFrames, automatisk opkald af partnerlinket eller anden teknisk manipulation af tildelingen;",
        "Selvreklame: registrering af egne virksomheder, af aktionærer, medarbejdere eller pårørende via egen kode eller en team-partners kode;",
        "købt rækkevidde (købte følgere, klik-farme, bot-trafik) samt incitamenter til virksomheder for registrering (tilbagebetalinger, gaver, konkurrencer);",
        "Rekrutteringsløfter: rekruttering af partnere med indtægtsløfter, der ikke stammer fra betalt abonnementsomsætning, eller fremstilling af programmet som en indtægtskilde gennem rekruttering af yderligere partnere;",
        "Spam, ulovlig direkte markedsføring og brug af tredjeparts varemærker eller indhold uden ret hertil.",
      ],
    },
    {
      heading: "§ 7 Refusionsvindue, tilbagekaldelse, tilbageholdelse",
      paragraphs: [
        "Hver provisionslinje er åben i 30 dage (refusionsvindue) efter dens opståen og kan derefter udbetales. Hvis en underliggende faktura helt eller delvist refunderes eller tilbageføres (chargeback), tilbagekaldes provisionen – herunder en derpå baseret team-provision – forholdsmæssigt, også efter udbetaling, ved modregning med fremtidige provisioner.",
        "Ved mistanke om overtrædelse af § 2, § 5 eller § 6 kan myNextDays tilbageholde tildelinger og provisioner indtil afklaring. Hvis overtrædelsen bekræftes, bortfalder de berørte provisioner.",
      ],
    },
    {
      heading: "§ 8 Udbetaling og kreditnota",
      paragraphs: [
        "Udbetalbare provisioner samles månedligt pr. valuta og udbetales, så snart de når det minimumsbeløb for den pågældende valuta, der er angivet på programsiden eller i dashboardet. Der sker ingen omregning mellem valutaer.",
        "Afregningen sker via kreditnotaprocedure (selvfakturering, momsloven § 52a): myNextDays udsteder en kreditnota for hver udbetaling; partneren udsteder ingen faktura. Partneren accepterer kreditnotaproceduren.",
        "Virksomheder modtager kreditnotaen med henvisning til modtagerens skattepligt (Reverse Charge); en gyldig, bekræftet momsregistreringsnummer er en forudsætning. Privatpersoner modtager kreditnotaen uden moms og beskatter selv provisionen.",
        "Udbetalingen sker via SEPA-overførsel, Wise eller PayPal til de data, som partneren har angivet i dashboardet.",
      ],
    },
    {
      heading: "§ 9 Data og indsigt",
      paragraphs: [
        "Partneren ser tildelte virksomheder pseudonymt (nummer, land, status, beløb). Navne, e-mailadresser eller bookingdata for virksomhederne offentliggøres ikke. En sponsor ser sine team-partneres navn eller firmanavn, rang, antal betalende kunder og den deraf følgende team-provision, men ingen kundedetaljer.",
        "For tilknyttede konti og oprettede indlæg ser myNextDays følgere, visninger, interaktioner samt klik og kunder pr. indlæg. Uregelmæssigheder (f.eks. et følger-spring uden passende visninger eller en betydelig afvigelse mellem selvangivelse og verificeret værdi) er indikationer for en personlig kontrol i henhold til § 6 og § 10, ikke en automatisk spærring.",
        "Behandlingen af personoplysninger i partnerprogrammet er beskrevet i databeskyttelseserklæringen.",
      ],
    },
    {
      heading: "§ 10 Varighed, spærring og opsigelse",
      paragraphs: [
        "Deltagelsen er tidsubegrænset og kan af begge parter opsiges skriftligt til enhver tid. Allerede opståede, udbetalbare provisioner udbetales i henhold til § 8; efter opsigelse opstår der ingen nye provisioner.",
        "myNextDays kan spærre partneren ved overtrædelse af disse betingelser. Under spærringen tilbageholdes provisioner; ved bekræftet overtrædelse bortfalder de.",
      ],
    },
    {
      heading: "§ 11 Ændringer",
      paragraphs: [
        "myNextDays kan ændre disse betingelser og niveauet med virkning for fremtiden. Ændringer vil blive offentliggjort i partner-dashboardet og på denne side med versionsnummer; ved væsentlige ændringer vil partneren blive bedt om fornyet samtykke. Allerede opståede provisioner forbliver upåvirkede.",
      ],
    },
    {
      heading: "§ 12 Gældende ret",
      paragraphs: [
        "Dansk ret finder anvendelse med undtagelse af international privatret. Obligatoriske forbrugerbeskyttelsesbestemmelser i den stat, hvor en privat partner har sit sædvanlige opholdssted, forbliver upåvirkede.",
      ],
    },
  ],
};
