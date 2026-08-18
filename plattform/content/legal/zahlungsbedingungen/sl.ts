import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Plačilni pogoji",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ti plačilni pogoji urejajo, kako se izvajajo plačila v zvezi z rezervacijo prek myBestDays. Dopolnjujejo [Pogoje uporabe za goste](https://mybestdays.dk/rechtliches/nutzungsbedingungen); ob nasprotjih glede plačilnih vprašanj imajo prednost ti plačilni pogoji.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Naša vloga pri plačilu",
      paragraphs: [
        "myBestDays izvaja plačila v imenu ponudnika. Nismo plačilna institucija in ne institucija za izdajo elektronskega denarja; samo plačilno storitev opravlja naš ponudnik plačilnih storitev.",
        "Plačila prek Platforme izvaja Stripe (Stripe Payments Europe, Limited). Podatke o karticah in druge plačilne podatke zbira in obdeluje neposredno Stripe. myBestDays ne shranjuje popolnih podatkov o karticah.",
        "Če plačate prek Platforme, se vaša plačilna obveznost do ponudnika v višini plačanega zneska šteje za izpolnjeno, takoj ko je plačilo pri našem ponudniku plačilnih storitev uspešno avtorizirano in zaračunano.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Načini plačila",
      paragraphs: [
        "Kateri načini plačila so na voljo, je odvisno od oglasa, države ponudnika in vaše države. Razpoložljivi načini plačila se vam prikažejo pred zaključkom rezervacije.",
        "Za določene načine plačila je potrebna močna avtentikacija stranke po Direktivi (EU) 2015/2366. Brez uspešne avtentikacije plačila ni mogoče izvesti.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Zapadlost, predplačilo in doplačilo",
      paragraphs: [
        "Kdaj zapade posamezen znesek, določi ponudnik v oglasu. Običajni so trije modeli: celotno plačilo ob rezervaciji, predplačilo ob rezervaciji z doplačilom pred prihodom, ali plačilo na kraju samem pri ponudniku.",
        "Model, ki velja za vašo rezervacijo, in datumi zapadlosti se prikažejo pred zaključkom rezervacije in ponovijo v potrdilu rezervacije.",
        "Pred zapadlostjo doplačila vas opomnimo na navedeni e-naslov. Če doplačilo izostane, lahko ponudnik po svojih pogojih odpovedi odstopi od pogodbe.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Valuta",
      paragraphs: [
        "Obračun poteka v valuti oglasa. Ta valuta je navedena pri vsaki ceni in v postopku plačila.",
        "Če se vam znesek prikaže tudi v drugi valuti, gre za nezavezujočo preračunavo v informativne namene in ne za zavezujočo ceno.",
        "Če vaš ponudnik plačilnih storitev preračuna v drugo valuto ali zaračuna nadomestilo za tujino, te stroške nosite vi. Niso sestavni del skupne cene in jih ne določamo ne pobiramo mi.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Varščina",
      paragraphs: [
        "Če oglas predvideva varščino, je njena višina navedena pred zaključkom rezervacije.",
        "Glede na oglas se varščina na vašem plačilnem sredstvu predhodno avtorizira (znesek se rezervira, vendar ne bremeni) ali zaračuna. Predhodna avtorizacija lahko začasno zmanjša razpoložljivi limit vaše kartice.",
        "Po bivanju se predhodna avtorizacija sprosti ali zaračunana varščina vrne, kolikor ponudnik ne uveljavlja škode. Če ponudnik uveljavlja škodo, jo mora dokazati; o utemeljenosti odloča razmerje med vami in ponudnikom.",
        "Če ponudnik varščino namesto tega zahteva na kraju samem, gre za postavko stroškov na kraju samem in se ne izvaja prek Platforme.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Vračila",
      paragraphs: [
        "Vračila se izvedejo na plačilno sredstvo, uporabljeno za plačilo, razen če je dogovorjeno drugače ali to tehnično ni mogoče.",
        "Vračilo sprožimo nemudoma, takoj ko je njegov razlog ugotovljen. Kako dolgo traja, da postane dobropis viden na vašem računu ali kartici, določa vaš ponudnik plačilnih storitev; običajno pet do deset bančnih delovnih dni.",
        "Ali in v kakšni višini obstaja pravica do vračila, je odvisno od [Pogojev odpovedi](https://mybestdays.dk/rechtliches/stornierungsbedingungen) in [Politike prerezervacije in vračila](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Neuspela plačila in storniranja",
      paragraphs: [
        "Če plačilo ne uspe, vas obvestimo in vam omogočimo, da vnesete drugo plačilno sredstvo. Če plačilo izostane, se rezervacija lahko odpove.",
        "Če stornirate že izvedeno plačilo, ne da bi obstajala pravica do vračila, lahko ponudnik znesek še naprej zahteva. Stroške, ki nam nastanejo zaradi neupravičenega storniranja, vam lahko zaračunamo.",
        "Če plačilo štejemo za goljufivo, ga lahko zadržimo ali rezervacijo odpovemo. O tem vas obvestimo in odločitev obrazložimo.",
      ],
    },
    {
      id: "belege",
      heading: "8. Dokazila in obračuni",
      paragraphs: [
        "Za zneske, plačane prek Platforme, vam zagotovimo dokazilo, ki ga najdete v svojem računu pod »Rezervacije«.",
        "Račun za nastanitveno storitev izda ponudnik; on je izvajalec kot podjetnik. Glede davkov glej [Davčno politiko](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Spremembe teh plačilnih pogojev",
      paragraphs: [
        "Za spremembe teh plačilnih pogojev velja razdelek A22 [Pogojev uporabe](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};
