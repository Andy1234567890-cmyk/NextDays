import type { LegalDoc } from "../types";

// Dänische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. Zielgruppe sind Verbraucher (Gäste) — anders als die
// Agentur-AGB in apps/web.
export const agb: LegalDoc = {
  title: "Brugsvilkår for gæster",
  stand: "Senest opdateret: 3. juli 2026",
  intro: [
    "Disse brugsvilkår regulerer rejsendes og bestilleres (herefter »gæsten«) brug af bookingportalen myBestDays (herefter »platformen«).",
    "Platformen drives af [fuldt firmanavn, selskabsform, adresse og registreringsoplysninger for operatøren — udfyldes inden offentliggørelse] (herefter »myBestDays« eller »vi«).",
  ],
  sections: [
    {
      heading: "§ 1 Anvendelsesområde",
      paragraphs: [
        "Disse vilkår gælder for brugen af platformen, navnlig for søgning efter overnatningssteder og booking af overnatningsydelser via platformen.",
        "For selve overnatningsydelsen gælder desuden den pågældende udbyders betingelser (f.eks. husorden, afbestillingsbetingelser), som er angivet i tilbuddet.",
      ],
    },
    {
      heading: "§ 2 myBestDays' rolle; aftaleindgåelse",
      paragraphs: [
        "myBestDays formidler overnatningsydelser, der udbydes af de pågældende udbydere (bureauer, udlejere eller ejere, herefter »udbyderen«). Aftalen om overnatningsstedet indgås udelukkende mellem gæsten og den pågældende udbyder. myBestDays bliver ikke part i overnatningsaftalen.",
        "Den pågældende udbyder angives i tilbuddet og i bookingbekræftelsen.",
      ],
    },
    {
      heading: "§ 3 Booking og bookingbekræftelse",
      paragraphs: [
        "Præsentationen af overnatningsstederne på platformen er en opfordring til at afgive et bookingtilbud. Ved at gennemføre bookingprocessen (klik på bookingknappen med betalingsforpligtelse) afgiver gæsten et bindende tilbud om indgåelse af en overnatningsaftale med udbyderen.",
        "Aftalen indgås, når bookingen bekræftes. Bookingbekræftelsen sendes til gæsten på den angivne e-mailadresse.",
        "Gæsten er forpligtet til at afgive korrekte og fuldstændige oplysninger ved bookingen (navnlig navn, kontaktoplysninger og antal rejsende).",
      ],
    },
    {
      heading: "§ 4 Priser og betaling",
      paragraphs: [
        "De priser, der er angivet i tilbuddet på bookingtidspunktet, er gældende, inklusive de dér angivne skatter, gebyrer og ekstraomkostninger. Priser vises i den valuta, der er angivet i tilbuddet. På stedet kan der påløbe yderligere lokale afgifter (f.eks. turistskat), i det omfang det er angivet i tilbuddet.",
        "Betalingen behandles via betalingstjenesteudbyderen Stripe. Betalingsdata (f.eks. kortoplysninger) indsamles og behandles direkte af Stripe; myBestDays gemmer ikke fuldstændige kortoplysninger. Stripe behandler personoplysninger i overensstemmelse med [Stripes privatlivspolitik](https://stripe.com/privacy).",
        "Hvis der er angivet et depositum i tilbuddet, kan det forhåndsautoriseres ved booking eller ankomst og helt eller delvist tilbageholdes i tilfælde af skade; oplysningerne i tilbuddet er afgørende.",
      ],
    },
    {
      heading: "§ 5 Afbestilling, ombooking og fortrydelse",
      paragraphs: [
        "Om og på hvilke betingelser en booking kan afbestilles eller ændres gratis, afhænger af udbyderens afbestillingsbetingelser, som er angivet i tilbuddet.",
        "For overnatningsydelser, der bookes til en bestemt periode, gælder der i henhold til artikel 16, litra l, i EU's forbrugerrettighedsdirektiv og de tilsvarende nationale regler som udgangspunkt ingen lovbestemt fortrydelsesret. Gæstens ufravigelige lovbestemte rettigheder berøres ikke.",
      ],
    },
    {
      heading: "§ 6 Gæstens forpligtelser",
      paragraphs: [
        "Gæsten benytter overnatningsstedet i overensstemmelse med aftalen, overholder det maksimale antal personer, der er angivet i tilbuddet, og respekterer udbyderens husorden.",
        "Platformen må ikke misbruges, navnlig ikke til proformabookinger, svigagtige betalinger eller offentliggørelse af ulovligt indhold (f.eks. i anmeldelser eller beskeder).",
      ],
    },
    {
      heading: "§ 7 myBestDays' ansvar",
      paragraphs: [
        "Udbyderen er alene ansvarlig for leveringen af overnatningsydelsen. myBestDays hæfter ikke for rigtigheden af det tilbudsindhold, som udbyderne har lagt op, men varetager formidlingen og betalingsbehandlingen med den omhu, der påhviler en ordentlig erhvervsdrivende.",
        "myBestDays hæfter ubegrænset for forsæt og grov uagtsomhed samt for skader som følge af krænkelse af liv, legeme eller helbred. Ved simpel uagtsomhed hæfter myBestDays kun for tilsidesættelse af væsentlige kontraktforpligtelser (kardinalforpligtelser), begrænset til den for aftalen typiske, påregnelige skade. Ufravigelige lovbestemte ansvarsregler berøres ikke.",
      ],
    },
    {
      heading: "§ 8 Databeskyttelse",
      paragraphs: [
        "myBestDays behandler gæstens personoplysninger med henblik på gennemførelse af formidlingen og bookingen. Bookingdata videregives til den pågældende udbyder, i det omfang det er nødvendigt for at opfylde overnatningsaftalen. For betalingsbehandlingen gælder § 4.",
        "Nærmere oplysninger fremgår af platformens oplysninger om databeskyttelse.",
      ],
    },
    {
      heading: "§ 9 Klager og tvistbilæggelse",
      paragraphs: [
        "Klager over overnatningsstedet retter gæsten i første omgang til udbyderen; ved spørgsmål om booking eller betaling hjælper myBestDays' support via de kontaktkanaler, der er angivet på platformen.",
        "myBestDays er hverken forpligtet eller villig til at deltage i tvistbilæggelsesprocedurer ved et forbrugerklagenævn, medmindre der består en lovbestemt pligt hertil.",
      ],
    },
    {
      heading: "§ 10 Ændringer af disse vilkår",
      paragraphs: [
        "myBestDays kan ændre disse vilkår med virkning for fremtiden, i det omfang det er nødvendigt af vægtige grunde (navnlig lovændringer eller ændringer i retspraksis), og gæsten ikke stilles urimeligt ringere herved. For allerede indgåede bookinger gælder den affattelse, der var gældende på bookingtidspunktet.",
      ],
    },
    {
      heading: "§ 11 Afsluttende bestemmelser",
      paragraphs: [
        "Retten i den stat, hvor operatøren har sit hjemsted, finder anvendelse med udelukkelse af FN's konvention om aftaler om internationale køb (CISG). Er gæsten forbruger, berøres de ufravigelige forbrugerbeskyttelsesregler i den stat, hvor gæsten har sit sædvanlige opholdssted, ikke.",
        "Skulle enkelte bestemmelser i disse vilkår være eller blive ugyldige, berøres gyldigheden af de øvrige bestemmelser ikke.",
      ],
    },
  ],
};
