import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Betalinger & fakturaer",
  description: "Betalingsudbydere, betalingsregler og fakturaer.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Betalinger",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Forbind betalingsudbyder",
          excerpt:
            "Sådan forbinder du Stripe eller PayPal med myNextDays for at afvikle betalinger automatisk.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Tilgængelige udbydere" },
            {
              type: "p",
              text: "myNextDays afvikler betalinger via tilsluttede betalingsudbydere. Aktuelt understøttes Stripe og PayPal — du kan forbinde en eller begge udbydere samtidig og bruge dem afhængigt af bolig eller gæstens ønske.",
            },
            {
              type: "steps",
              items: [
                "Åbn Konto, og skift til afsnittet »Betalinger«.",
                "Vælg den ønskede udbyder — Stripe eller PayPal.",
                "Følg forbindelsesdialogen, og log ind hos udbyderen, eller opret en ny konto.",
                "Bekræft forbindelsen — status skifter til »forbundet«.",
              ],
            },
            { type: "h2", text: "Hvad der sker derefter" },
            {
              type: "p",
              text: "Så snart en udbyder er forbundet, kan du sende betalingslinks, opkræve depositum og udløse tilbagebetalinger direkte fra reservationen. Alle beløb behandles i den valuta, der er angivet for den pågældende bolig.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Uden en forbundet udbyder kan du kun markere betalinger som modtaget manuelt — en automatisk opkrævning er så ikke mulig.",
            },
            { type: "h2", text: "Flere boliger, én udbyder" },
            {
              type: "p",
              text: "En forbindelse, der er oprettet én gang, gælder for hele kontoen for alle dine boliger. Hvordan opkrævningen konkret foregår, fastlægger du via [Betalingsregler](/hilfe/zahlungen/zahlungsregeln). Udbetalinger til dig sker derefter via den pågældende udbyder, se [Udbetalinger](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe egner sig til kortbetalinger og mange lokale betalingsmetoder",
                "PayPal giver gæster et velkendt alternativ",
                "Begge udbydere kan afbrydes og genforbindes uafhængigt af hinanden",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Betalingsregler",
          excerpt: "Fastlæg, hvornår depositum og restbetaling for en reservation forfalder.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Depositum og restbetaling" },
            {
              type: "p",
              text: "Betalingsregler bestemmer, hvordan en reservation afvikles økonomisk — for eksempel et depositum ved reservationen og en restbetaling før ankomst, eller fuld betaling med det samme. Reglerne gælder pr. bolig og kan til enhver tid tilpasses.",
            },
            {
              type: "steps",
              items: [
                "Åbn boligen, og skift til afsnittet »Betalingsregler«.",
                "Vælg, om der opkræves et depositum, og fastlæg andelen.",
                "Bestem, hvornår restbetalingen forfalder, for eksempel et bestemt antal dage før ankomst.",
                "Gem indstillingerne.",
              ],
            },
            { type: "h2", text: "Automatisk opkrævning" },
            {
              type: "p",
              text: "Er en betalingsudbyder forbundet, opkræver myNextDays automatisk depositum og restbetaling på det angivne tidspunkt og informerer gæsten på forhånd via en besked.",
            },
            {
              type: "note",
              variant: "info",
              text: "Betalingsregler virker kun ved reservationer med en forbundet betalingsudbyder. Uden en udbyder markerer du betalinger manuelt i reservationen.",
            },
            { type: "h2", text: "Forskelle pr. kanal" },
            {
              type: "p",
              text: "På portaler kan deres egen betalingsafvikling afvige og gælde i stedet — kontrollér i så fald de pågældende portalbetingelser. For reservationer via din egen platform eller hjemmeside gælder altid de regler, du har angivet her. Detaljer om udbyderforbindelsen finder du under [Forbind betalingsudbyder](/hilfe/zahlungen/zahlungsanbieter-verbinden), om fakturering under [Opret fakturaer](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Depositum kan angives som et fast beløb eller en procentsats",
                "Frist for restbetaling kan vælges frit",
                "Ændringer gælder først for nye reservationer, ikke med tilbagevirkende kraft",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Opret fakturaer",
          excerpt: "Sådan opretter du en faktura til en reservation med korrekt faktureringsadresse.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Opret faktura" },
            {
              type: "p",
              text: "Der kan oprettes en faktura til enhver reservation — til gæsten selv eller til en anden virksomhed, hvis reservationen sker erhvervsmæssigt.",
            },
            {
              type: "steps",
              items: [
                "Åbn reservationen under Reservationer.",
                "Vælg »Opret faktura«.",
                "Kontrollér eller udfyld faktureringsadressen.",
                "Kontrollér de angivne poster — overnatning, tilkøb, gebyrer.",
                "Opret fakturaen, og send den til gæsten.",
              ],
            },
            { type: "h2", text: "Vedligehold faktureringsadresse" },
            {
              type: "p",
              text: "Faktureringsadressen kan du angive direkte i reservationen eller lade gæsten eftersende via reservationsbekræftelsen. Uden en fuldstændig adresse kan der i visse lande ikke udstedes en juridisk gyldig faktura.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Kontrollér især firmanavn og adresse ved erhvervskunder — efterfølgende rettelser kræver en rettelsesfaktura.",
            },
            { type: "h2", text: "Beløb og valuta" },
            {
              type: "p",
              text: "Alle poster angives i den valuta, der er angivet for boligen. Allerede foretagne betalinger noteres på fakturaen som betalingsindgang. Hvordan depositum og restbetaling kommer i stand, kan du læse under [Betalingsregler](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Fakturaer kan downloades som PDF",
                "Rettelsesfakturaer er altid mulige ved ændringer",
                "Tilkøb vises som en separat post",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Tilbagebetalinger",
          excerpt:
            "Sådan tilbagebetaler du en betaling helt eller delvist, når en reservation annulleres eller ændres.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Hvornår en tilbagebetaling er nødvendig" },
            {
              type: "p",
              text: "En tilbagebetaling opstår typisk ved en annullering, men kan også være nødvendig ved en efterfølgende prisjustering eller et annulleret tilkøb.",
            },
            {
              type: "steps",
              items: [
                "Åbn den pågældende reservation under Reservationer.",
                "Vælg »Tilbagebetaling« i reservationens betalingsafsnit.",
                "Angiv det beløb, der skal tilbagebetales — helt eller delvist.",
                "Bekræft tilbagebetalingen.",
              ],
            },
            { type: "h2", text: "Forløb via betalingsudbyderen" },
            {
              type: "p",
              text: "Tilbagebetalingen udføres via den udbyder, der blev brugt til betalingen — Stripe eller PayPal — og overføres direkte tilbage til gæstens oprindelige betalingsmiddel. Forløbet noteres automatisk i reservationens tidslinje.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Uden en forbundet betalingsudbyder kan en tilbagebetaling ikke udløses automatisk — afklar i så fald tilbagebetalingen direkte med gæsten.",
            },
            { type: "h2", text: "Indvirkning på provisioner" },
            {
              type: "p",
              text: "Allerede afregnede markedsplads- eller portalprovisioner justeres forholdsmæssigt ved en tilbagebetaling. Mere om dette under [Forstå provisioner](/hilfe/zahlungen/provisionen-verstehen). Detaljer om selve annulleringen finder du under [Annullering & tilbagebetaling](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Delvise tilbagebetalinger er mulige for enkelte poster",
                "Behandlingsstatussen er altid synlig i reservationen",
                "Tilbagebetalinger foregår udelukkende via den oprindeligt anvendte udbyder",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Udbetalinger",
          excerpt:
            "Sådan modtager du provenuet fra dine reservationer udbetalt fra de tilsluttede betalingsudbydere.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Sådan fungerer udbetalinger" },
            {
              type: "p",
              text: "Indgående betalinger samles først hos den forbundne betalingsudbyder. Derfra sker udbetalingen til din angivne bankkonto efter udbyderens sædvanlige rytme.",
            },
            {
              type: "steps",
              items: [
                "Åbn Konto, og skift til afsnittet »Betalinger«.",
                "Kontrollér status for den pågældende udbyder under »Udbetalinger«.",
                "Åbn om nødvendigt udbyderens detaljevisning for den fuldstændige udbetalingshistorik.",
              ],
            },
            { type: "h2", text: "Hvad der trækkes fra før udbetaling" },
            {
              type: "p",
              text: "Før udbetalingen tages der hensyn til gældende markedsplads- og portalprovisioner samt udbydergebyrer. Det udbetalte beløb svarer derfor ikke nødvendigvis til den oprindelige reservationssum.",
            },
            {
              type: "note",
              variant: "info",
              text: "Den nøjagtige opbygning af fradragene forklares i [Forstå provisioner](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Flere boliger og ejere" },
            {
              type: "p",
              text: "Administrerer du boliger for forskellige ejere, fordeles udbetalinger i overensstemmelse med de angivne ejerafregninger. Kontrollér ved uoverensstemmelser først status for de underliggende reservationer under Reservationer.",
            },
            {
              type: "ul",
              items: [
                "Udbetalingsrytme og -metode bestemmes af den pågældende udbyder",
                "Tilbageholdte beløb, f.eks. ved igangværende tilbagebetalinger, er markeret",
                "Den fuldstændige historik kan ses direkte hos udbyderen",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Forstå provisioner",
          excerpt:
            "Et overblik over, hvordan markedsplads- og portalprovisioner er sammensat, og hvor de afregnes.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "To typer provisioner" },
            {
              type: "p",
              text: "Ved reservationer via myNextDays kan der opstå to forskellige provisioner: markedsplads-provisionen for reservationer via din egen platform samt portalprovisioner for reservationer, der kommer ind via tilsluttede portaler som Booking eller Airbnb. Begge er uafhængige af hinanden og kan variere afhængigt af reservationens salgskanal.",
            },
            {
              type: "ul",
              items: [
                "Markedsplads-provision: opstår ved reservationer via myBestDays-platformen",
                "Portal-provision: beregnes af det pågældende portal i henhold til dets egne vilkår",
                "Direkte reservationer via din egen hjemmeside skal betragtes uafhængigt heraf",
              ],
            },
            { type: "h2", text: "Hvor provisioner er synlige" },
            {
              type: "steps",
              items: [
                "Åbn Konto, og skift til afsnittet »Afregning«.",
                "Vælg den ønskede måned.",
                "Kontrollér oversigten pr. reservation med tilhørende provision.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Hvilken kanal en reservation kom ind via, kan du se direkte på selve reservationen — det forklarer, hvilken provision der er anvendt.",
            },
            { type: "h2", text: "Sammenhæng med udbetalinger" },
            {
              type: "p",
              text: "Provisioner trækkes fra reservationssummen før udbetalingen. Detaljer om udbetalingsforløbet finder du under [Udbetalinger](/hilfe/zahlungen/auszahlungen). Ved en tilbagebetaling korrigeres den tilhørende provision forholdsmæssigt — det fulde forløb af en reservation vises i [Reservations-tidslinjen](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
