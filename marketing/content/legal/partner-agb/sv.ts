// Partner-AGB — Schwedisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Villkor för deltagande i myNextDays partnerprogram: Attribution, provisionsgrund, nivåer, teamprovision, förbud, märkning, utbetalning.",
  numbered: false,
  toc: true,
  title: "Villkor för deltagande i partnerprogrammet (Partner-AGB) — Utkast",
  standIso: "2026-09-02",
  intro: [
    "UTKAST — Dessa villkor är ett arbetsdokument från myNextDays och har ännu inte granskats av jurister. Fram till dess att den granskade versionen släpps, gäller de som en beskrivning av programmet, inte som en slutgiltig avtalstext. Den granskade versionen kommer att publiceras på denna adress med ett nytt versionsnummer; partners kommer att ombes att godkänna den igen vid nästa inloggning.",
    `Dessa deltagarvillkor reglerar deltagandet i partnerprogrammet (affiliate-programmet) för ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (nedan kallat ”myNextDays” eller ”vi”) av partners (nedan kallade ”Partner”).`,
    "Partnerprogrammet riktar sig till personer och företag med säte i EU, Schweiz eller Storbritannien, som rekommenderar verksamheter (uthyrare, agenturer, hotell) till myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Deltagande och godkännande",
      paragraphs: [
        "Deltagandet förutsätter en ansökan via partner-instrumentpanelen. Obligatoriska uppgifter är namn eller företagsnamn, juridisk form, land, minst ett sociala medier-konto med adress, användarnamn och räckvidd, samt för företag momsregistreringsnummer.",
        "myNextDays granskar varje ansökan personligen och beslutar fritt om godkännande. Det finns ingen rätt till antagning. Deltagandet är kostnadsfritt; ett abonnemang på myNextDays är inget krav.",
        "Partnern håller sina uppgifter aktuella, särskilt kanaler, juridisk form, skatte- och utbetalningsuppgifter.",
        "Den angivna räckvidden är initialt en självdeklaration. Partnern kan frivilligt ansluta sina konton på YouTube, Instagram, Facebook och TikTok; då läses följare och visningar från plattformen och visas som verifierade. Icke-verifierad räckvidd viktas lägre vid godkännande och vid senare granskningar. Anslutningen kan när som helst kopplas bort i instrumentpanelen; detaljer om behandlingen finns i integritetspolicyn.",
      ],
    },
    {
      heading: "§ 2 Tilldelning av verksamheter (Attribution)",
      paragraphs: [
        "En verksamhet tilldelas Partnern om den registrerar sig med Partnerns rekommendationskod. Koden visas tydligt för verksamheten vid registreringen och bekräftas genom att skickas in. Inga spårningscookies används.",
        "En verksamhet tilldelas exakt en Partner; avgörande är den kod som bekräftades vid registreringen. En senare omfördelning sker endast av myNextDays vid bevisat fel.",
        "Verksamheter som tillhör Partnern själv, dess delägare, anställda eller anhöriga, samt verksamheter som redan är eller har varit kunder hos myNextDays, tilldelas inte.",
      ],
    },
    {
      heading: "§ 3 Provision på egna kunder",
      paragraphs: [
        "Provisionsgrunden är den tilldelade verksamhetens nettoabonnemangsintäkter (grundtaxa och moduler) från betalda fakturor – exklusive moms, exklusive portalprovisioner, tilläggstjänster, efterkalkyler och andra genomgående poster.",
        "Provisionssatsen beror på partnerns rang vid betalningstillfället. Rangerna och satserna publiceras på programsidan. Rangordningen bestäms av antalet betalande kunder i partnerns struktur: dennes egna betalande kunder och de betalande kunderna hos dennes team-partners (§ 4), varje kund en gång. Rangordningen fastställs månadsvis på avstämningsdagen; en uppgradering gäller omedelbart, en nedgradering först när antalet har legat under tröskeln vid två på varandra följande avstämningsdagar.",
        "Om partnern för första gången uppnår en rang från och med ”Aufsteiger”, erhåller denne en engångsbonus för uppgradering som anges för denna rang på programsidan (för närvarande 50,00 EUR per rang, för alla partners i euro). Varje rang ersätts endast en gång, även efter nedgradering och förnyad uppgradering. Bonusen omfattas av återbetalningsfönstret enligt § 7.",
        "Provisionen uppstår per verksamhet under tolv månader från dess första betalningspliktiga abonnemangsfaktura; en kostnadsfri testperiod och en gratismånad som förmedlats via partnern räknas inte. Om abonnemanget avslutas tidigare, upphör provisionen med den sista betalda fakturan.",
        "Från rangen ”Elite-Partner” erhåller partnern dessutom en superprovision i den höjd som anges på programsidan (för närvarande 2,5 %) på nettoabonnemangsomsättningen för alla kunder i dennes struktur – egna kunder och kunder hos dennes team-partners – utan tidsgränsen på tolv månader, så länge respektive kund har ett betalande abonnemang och partnern innehar rangen vid betalningstillfället. Den uppstår utöver provisionen enligt stycke 2 och § 4.",
        "För varje bokning som inkommer och betalas via myBestDays för en verksamhet som är kopplad till partnern eller en av dennes team-partners, erhåller partnern en bokningsandel i den höjd som anges på programsidan (för närvarande 0,5 %) av det belopp som gästen betalat i bokningsvalutan, utan tidsgräns, så länge kopplingen består. Depositioner är inte ett bokningsbelopp. Återbetalningar till gästen minskar andelen proportionellt (§ 7).",
      ],
    },
    {
      heading: "§ 4 Team-provision",
      paragraphs: [
        "Från rangen ”Aufsteiger” får en partner leda team-partners. Om en annan partner ansöker via partnerns team-länk och bekräftar dennes kod synligt i sin ansökan, tilldelas denne, efter godkännande, partnerns team (nedan ”Sponsor”). Om sponsorn inte innehar rangen vid ansökningstillfället, förblir ansökan giltig, men ingen team-tilldelning uppstår.",
        "Sponsorn erhåller en team-provision på nettoabonnemangsomsättningen för sina team-partners kunder, motsvarande skillnaden mellan sin egen provisionssats och team-partnerns provisionssats, baserat på rangen vid betalningstillfället. Om båda har samma rang eller om team-partnern har en högre rang, uppstår ingen team-provision. Team-partnerns provision och sponsorns team-provision överstiger tillsammans aldrig den högsta satsen i skalan (för närvarande 30 %).",
        "Teamprovisionen är exakt en nivå djup: Team-partners får ingen teamprovision på partners som de själva rekryterar. Ingen ersättning utgår för rekrytering av en partner; ingen deltagaravgift tas ut. Teamprovisionen uppstår uteslutande från betald abonnemangsomsättning.",
        "Teamprovisionen löper per teamkund i tolv månader från dennes första betalda faktura, omfattas av samma återbetalningsperiod och återtas proportionerligt vid återbetalning eller återdebitering (§ 7). Den uppstår endast så länge sponsor och team-partner är godkända; annars hålls den inne tills klarhet uppnåtts.",
        "Teamtilldelningen är engångs. En ändring sker endast av myNextDays med dokumenterad anledning.",
      ],
    },
    {
      heading: "§ 5 Partnerns skyldigheter och märkning",
      paragraphs: [
        "Partnern märker varje rekommendation med sin länk eller kod som reklam – i början av inlägget, på inläggets språk, i enlighet med bestämmelserna i sitt land (i Tyskland bl.a. § 5a Abs. 4 UWG, i Danmark markedsføringsloven § 6 Abs. 4). Formuleringar per land tillhandahålls av myNextDays i partner-instrumentpanelen.",
        "Partnern lämnar endast information om myNextDays som överensstämmer med de publicerade tjänstebeskrivningarna och lämnar inga löften på myNextDays vägnar. Särskilt förbjudet är löften om framgång och garantier (t.ex. ”garanterad full beläggning på tre dagar”) samt uttalanden om intäkter som inte följer av de publicerade tjänstebeskrivningarna.",
        "Varje video och varje inlägg som nämner myNextDays eller bär partnerns länk ska före publicering lämnas in som fil i partner-instrumentpanelen för granskning. Partnerns länk uppstår först efter skriftligt godkännande från myNextDays; publicering utan godkännande är förbjuden. myNextDays kan återkalla ett godkännande; redan uppkomna provisioner förblir opåverkade.",
        "För logotyper, skärmbilder, B-Roll, överlägg och skärmdumpar använder partnern uteslutande det reklammaterial som tillhandahålls av myNextDays. Egna, ogranskade programvaruupptagningar är inte tillåtna.",
      ],
    },
    {
      heading: "§ 6 Förbjudna metoder",
      paragraphs: ["Särskilt förbjudet är:"],
      list: [
        "Brand-Bidding: betalda annonser på varumärket ”myNextDays”, stavningsvarianter och kombinationer (t.ex. ”myNextDays priser”) i sökmotorer och nätverk;",
        "Cookie-dropping, dolda omdirigeringar, iFrames, automatiserad åtkomst till partnerlänken eller annan teknisk manipulation av tilldelningen;",
        "Självreklam: registrering av egna företag, av delägare, anställda eller anhöriga via egen kod eller en team-partners kod;",
        "köpt räckvidd (köpta följare, klickfarmar, bot-trafik) samt incitament till företag för registrering (återbetalningar, presenter, tävlingar);",
        "Rekryteringslöften: rekrytering av partners med inkomstlöften som inte härrör från betald abonnemangsomsättning, eller framställning av programmet som en inkomstkälla genom rekrytering av ytterligare partners;",
        "Skräppost, otillåten direktreklam och användning av tredje parts varumärken eller innehåll utan rättighet.",
      ],
    },
    {
      heading: "§ 7 Återbetalningsfönster, återtagande, innehållande",
      paragraphs: [
        "Varje provisionsrad är öppen i 30 dagar efter dess uppkomst (återbetalningsfönster) och därefter utbetalningsbar. Om en underliggande faktura helt eller delvis återbetalas eller återkallas (chargeback), återtas provisionen – inklusive en därtill hörande teambaserad provision – proportionerligt, även efter utbetalning genom kvittning mot framtida provisioner.",
        "Vid misstanke om överträdelse av § 2, § 5 eller § 6 får myNextDays hålla inne tilldelningar och provisioner tills ärendet är klarlagt. Om överträdelsen bekräftas, förfaller de berörda provisionerna.",
      ],
    },
    {
      heading: "§ 8 Utbetalning och kreditering",
      paragraphs: [
        "Utbetalningsbara provisioner samlas månadsvis per valuta och betalas ut så snart de uppnår det minimibelopp i respektive valuta som anges på programsidan eller i instrumentpanelen. Ingen omräkning mellan valutor sker.",
        "Avräkningen sker genom kreditering (självfakturering, momsloven § 52a): myNextDays utfärdar en kreditnota för varje utbetalning; partnern utfärdar ingen faktura. Partnern godkänner krediteringsförfarandet.",
        "Företagare erhåller kreditnotan med hänvisning till mottagarens skattskyldighet (omvänd skattskyldighet); förutsättningen är ett giltigt, bekräftat momsregistreringsnummer. Privatpersoner erhåller kreditnotan utan moms och beskattar provisionen själva.",
        "Utbetalningen sker via SEPA-överföring, Wise eller PayPal till de uppgifter som partnern har angett i instrumentpanelen.",
      ],
    },
    {
      heading: "§ 9 Data och insyn",
      paragraphs: [
        "Partnern ser tilldelade företag pseudonymt (nummer, land, status, belopp). Namn, e-postadresser eller bokningsdata för företagen offentliggörs inte. En sponsor ser sina team-partners namn eller företagsnamn, rang, antal betalande kunder och den därmed uppkomna team-provisionen, inga kunddetaljer.",
        "För anslutna konton och skapade inlägg ser myNextDays följare, visningar, interaktioner samt klick och kunder per inlägg. Avvikelser (t.ex. ett följarhopp utan motsvarande visningar eller en tydlig avvikelse mellan självdeklaration och verifierat värde) är indikationer för en personlig granskning enligt § 6 och § 10, inte en automatisk spärr.",
        "Behandlingen av personuppgifter i partnerprogrammet beskrivs i integritetspolicyn.",
      ],
    },
    {
      heading: "§ 10 Löptid, spärr och uppsägning",
      paragraphs: [
        "Deltagandet löper på obestämd tid och kan av båda parter när som helst avslutas i textform. Redan uppkomna, utbetalningsbara provisioner betalas ut enligt § 8; efter uppsägning uppstår inga nya provisioner.",
        "myNextDays får spärra partnern vid överträdelser av dessa villkor. Under spärren hålls provisioner inne; vid bekräftad överträdelse förfaller de.",
      ],
    },
    {
      heading: "§ 11 Ändringar",
      paragraphs: [
        "myNextDays kan ändra dessa villkor och nivåerna med verkan för framtiden. Ändringar kommer att publiceras i partner-instrumentpanelen och på denna sida med versionsnummer; vid väsentliga ändringar kommer partnern att ombes att ge sitt samtycke igen. Redan intjänade provisioner förblir opåverkade.",
      ],
    },
    {
      heading: "§ 12 Tillämplig lag",
      paragraphs: [
        "Dansk lag ska tillämpas med undantag för internationell privaträtt. Tvingande konsumentskyddsbestämmelser i det land där en privat partner har sin vanliga vistelseort förblir opåverkade.",
      ],
    },
  ],
};
