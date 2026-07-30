import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Konto & abonnement",
  description: "Stamdata, abonnement, sikkerhed og 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Konto",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Virksomhedens stamdata",
          excerpt: "Vedligehold firmanavn, adresse og kontaktoplysninger for din virksomhed centralt.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Under /konto samler myNextDays alle virksomheds- og kontofunktioner som afsnit på én side — du behøver ikke skifte mellem mange undersider. Virksomhedens stamdata udgør grundlaget: firmanavn, selskabsform, adresse og kontaktoplysninger, som bruges til fakturaer, portaler og kommunikation med gæster.",
            },
            { type: "h2", text: "Åbn og rediger stamdata" },
            {
              type: "steps",
              items: [
                "Åbn /konto.",
                "Skift til afsnittet »Virksomhedens stamdata«.",
                "Kontrollér firmanavn, adresse, telefonnummer og e-mailadresse til henvendelser.",
                "Foretag dine ændringer.",
                "Gem afsnittet.",
              ],
            },
            { type: "h2", text: "Hvorfor disse oplysninger er vigtige" },
            {
              type: "p",
              text: "Virksomhedens stamdata indgår i fakturaer, i registreringen hos tilsluttede portaler og i lovpligtige oplysninger som f.eks. kolofonen. En ufuldstændig eller forældet adresse kan medføre, at fakturaer udstedes forkert, eller at portaltilslutninger forsinkes.",
            },
            {
              type: "ul",
              items: [
                "Firmanavn og selskabsform fremgår af alle udstedte fakturaer.",
                "Adressen skal bruges til registrering hos portaler.",
                "Kontaktoplysninger fungerer som reserveløsning, hvis systemnotifikationer ikke når frem.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ændrer du din faktureringsadresse, bør du efterfølgende kontrollere allerede udstedte fakturaer under [Fakturering & prisberegner](/hilfe/konto-abo/abrechnung-tarifrechner) — eksisterende bilag tilpasses ikke med tilbagevirkende kraft.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Abonnement & tarif",
          excerpt: "Dit abonnement bestemmer boligkvoten — det aktuelt bookede antal boliger ser du altid i kontoen.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Dit myNextDays-abonnement omfatter en boligkvote: det maksimale antal boliger (værelser eller ferieboliger), du kan administrere aktivt samtidig. Det aktuelt bookede antal boliger vises i afsnittet »Abonnement & tarif« under /konto, sammen med den resterende kvote.",
            },
            { type: "h2", text: "Hold øje med kvoten" },
            {
              type: "p",
              text: "Kvoten håndhæves serverside: Når du når loftet for dit abonnement, kan der ikke oprettes flere boliger, før du deaktiverer en eksisterende bolig eller opgraderer dit abonnement. Det gælder uanset om den nye bolig er et værelse eller en feriebolig — begge tæller ens i kvoten.",
            },
            {
              type: "steps",
              items: [
                "Åbn /konto og afsnittet »Abonnement & tarif«.",
                "Kontrollér det bookede antal boliger i forhold til kvoten for dit abonnement.",
                "Vælg om nødvendigt et større abonnement for at oprette flere boliger.",
                "Bekræft abonnementsskiftet.",
              ],
            },
            {
              type: "ul",
              items: [
                "Hver bolig tæller individuelt i kvoten, uanset boligtype.",
                "Et abonnementsskift har øjeblikkelig virkning på den tilgængelige kvote.",
                "En nedgradering er kun mulig, hvis det aktive antal boliger passer til den nye kvote.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En nedgradering til et abonnement med mindre kvote afvises, så længe flere boliger er aktive, end det nye abonnement tillader. Deaktivér først overskydende boliger.",
            },
            {
              type: "note",
              variant: "info",
              text: "Detaljer om fakturaer og tarifberegning finder du under [Fakturering & prisberegner](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Fakturering & prisberegner",
          excerpt: "Faktureringsadresse, tidligere fakturaer og prisberegneren til din boligkvote.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Afsnittet »Fakturering & prisberegner« under /konto samler alt omkring fakturering: din faktureringsadresse, listen over tidligere fakturaer til download samt en prisberegner, hvormed du kan gennemskue omkostningerne for din nuværende eller en større boligkvote.",
            },
            { type: "h2", text: "Faktureringsadresse og fakturaer" },
            {
              type: "p",
              text: "Faktureringsadressen kan afvige fra virksomhedens adresse, f.eks. hvis en revisor modtager bilagene. Allerede udstedte fakturaer finder du sorteret kronologisk; hver enkelt kan downloades som PDF.",
            },
            { type: "h2", text: "Brug prisberegneren" },
            {
              type: "steps",
              items: [
                "Åbn /konto og afsnittet »Fakturering & prisberegner«.",
                "Indtast det ønskede antal boliger i prisberegneren.",
                "Sammenlign de resulterende omkostninger pr. abonnementstrin.",
                "Skift om nødvendigt direkte fra beregneren til det passende abonnement.",
              ],
            },
            {
              type: "ul",
              items: [
                "Prisberegneren viser omkostningerne i den valuta, der er registreret for din konto.",
                "Fakturaer er permanent tilgængelige til download.",
                "Faktureringsadressen kan vedligeholdes uafhængigt af virksomhedens stamdata.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Sammenlign jævnligt med prisberegneren, om din boligkvote stadig passer til det faktisk bookede antal boliger — se [Abonnement & tarif](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Skift adgangskode & e-mail",
          excerpt: "Sikkerhedskritiske ændringer kræver fornyet login og et bekræftelsestrin.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Adgangskode og e-mailadresse hører til de mest sikkerhedskritiske oplysninger på din konto. myNextDays kræver derfor fornyet autentificering ved begge ændringer — du bekræfter ændringen med din nuværende adgangskode, selvom du allerede er logget ind.",
            },
            { type: "h2", text: "Skift adgangskode" },
            {
              type: "steps",
              items: [
                "Åbn /konto og afsnittet »Skift adgangskode & e-mail«.",
                "Indtast din nuværende adgangskode til bekræftelse.",
                "Vælg den nye adgangskode, og gentag den.",
                "Gem ændringen.",
              ],
            },
            { type: "h2", text: "Skift e-mailadresse" },
            {
              type: "p",
              text: "Skift af e-mailadresse foregår som dobbelt opt-in: Efter bekræftelse af din nuværende adgangskode modtager du et bekræftelseslink til den NYE adresse. Først når du klikker på dette link, træder ændringen i kraft — den gamle adresse forbliver aktiv indtil da, så adgangen til din konto aldrig afbrydes.",
            },
            {
              type: "ul",
              items: [
                "Uden nuværende adgangskode kan hverken adgangskode eller e-mail ændres.",
                "Bekræftelseslinket til den nye e-mailadresse er kun gyldigt i en begrænset periode.",
                "Indtil bekræftelsen forbliver den hidtidige e-mailadresse aktiv til login og notifikationer.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Kontrollér også tofaktorautentificeringen efter en e-mailændring — se [Tofaktorautentificering](/hilfe/konto-abo/zwei-faktor) — hvis gendannelseskoder var knyttet til den gamle adresse.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Tofaktorautentificering",
          excerpt: "Et ekstra logintrin beskytter din konto mod uautoriseret adgang.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Tofaktorautentificering (2FA) supplerer din adgangskode med en anden faktor via en authenticator-app. Dermed er en stjålet adgangskode alene ikke længere nok til at logge ind på din myNextDays-konto.",
            },
            { type: "h2", text: "Opsæt 2FA" },
            {
              type: "steps",
              items: [
                "Åbn /konto og afsnittet »Tofaktorautentificering«.",
                "Bekræft din nuværende adgangskode til fornyet autentificering.",
                "Scan den viste QR-kode med en authenticator-app.",
                "Indtast den genererede kode til bekræftelse.",
                "Gem de viste gendannelseskoder et sikkert sted.",
              ],
            },
            { type: "h2", text: "Deaktivér 2FA" },
            {
              type: "p",
              text: "Også deaktivering af tofaktorautentificeringen kræver fornyet autentificering med din nuværende adgangskode. Sådan forhindrer myNextDays, at nogen med en allerede åben session blot slår din beskyttelse fra.",
            },
            {
              type: "ul",
              items: [
                "Gendannelseskoder giver adgang, hvis authenticator-appen går tabt.",
                "Hver gendannelseskode kan kun bruges én gang.",
                "Både til- og frakobling af 2FA kræver bekræftelse med adgangskode.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Opbevar dine gendannelseskoder adskilt fra den enhed, der har authenticator-appen, f.eks. i en password manager.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Enhedshistorik",
          excerpt: "Hold øje med, hvilke enheder din konto er logget ind fra.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Enhedshistorikken under /konto viser dig, hvilke enheder din konto aktuelt er logget ind på — med enhedstype, omtrentlig placering og tidspunkt for seneste aktivitet. Sådan genkender du hurtigt, om et login rent faktisk stammer fra dig.",
            },
            { type: "h2", text: "Kontrollér enhedshistorikken" },
            {
              type: "steps",
              items: [
                "Åbn /konto og afsnittet »Enhedshistorik«.",
                "Gennemgå listen over indloggede enheder.",
                "Genkender du en ukendt enhed, så log den af.",
                "Skift derefter din adgangskode af sikkerhedsmæssige årsager.",
              ],
            },
            { type: "h2", text: "Hvornår et blik er en god idé" },
            {
              type: "p",
              text: "Kontrollér enhedshistorikken især efter en ændring af adgangskode eller e-mail samt efter brug af en fremmed eller offentlig enhed. En ukendt post er et klart advarselstegn på uautoriseret adgang.",
            },
            {
              type: "ul",
              items: [
                "Hver post viser enhedstype, omtrentlig placering og seneste aktivitet.",
                "Enkelte enheder kan logges af selektivt uden at påvirke de andre.",
                "En ukendt enhed er anledning til et øjeblikkeligt skift af adgangskode.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Genkender du ikke en enhed, så log den af med det samme, og skift derefter din adgangskode under [Skift adgangskode & e-mail](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Databeskyttelse",
          excerpt: "Styr søgemaskineindeksering pr. bolig og eksportér dine data.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "I afsnittet »Databeskyttelse« under /konto styrer du to ting: om dine boligsider må indekseres af søgemaskiner, og hvordan du kan eksportere dine data, der er gemt hos myNextDays.",
            },
            { type: "h2", text: "Søgemaskineindeksering pr. bolig" },
            {
              type: "p",
              text: "Som standard er søgemaskineindekseringen deaktiveret for nye boliger. Først når du bevidst slår den til pr. bolig, må søgemaskiner som Google optage den offentlige boligside i deres indeks. Sådan bevarer du kontrollen over, hvilke boliger der kan findes uden for portaler og din egen platform.",
            },
            {
              type: "steps",
              items: [
                "Åbn /konto og afsnittet »Databeskyttelse«.",
                "Vælg den ønskede bolig fra listen.",
                "Slå søgemaskineindekseringen til eller fra.",
                "Brug samleknappen ved flere boliger for at sætte alle boliger ens.",
              ],
            },
            { type: "h2", text: "Eksportér data" },
            {
              type: "p",
              text: "Via dataeksportfunktionen anmoder du om en fuldstændig kopi af dine data, der er gemt i kontoen. Eksporten samles og stilles derefter til rådighed for dig til download.",
            },
            {
              type: "ul",
              items: [
                "Indekseringen kan styres individuelt pr. bolig, med samleknap for alle boliger.",
                "Nye boliger starter som udgangspunkt uden søgemaskineindeksering.",
                "Dataeksporten indeholder dine konto- og boligdata i struktureret form.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Søgemaskineindekseringen er uafhængig af synligheden på portaler og på din egen markedsplads — den vedrører udelukkende den offentlige boligside i søgemaskiner.",
            },
          ],
        },
      ],
    },
  ],
};
