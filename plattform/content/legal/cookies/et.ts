import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Küpsisepoliitika",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Käesolev poliitika selgitab, milliseid küpsiseid ja sarnaseid tehnoloogiaid myBestDays kasutab, milleks, kui kaua neid säilitatakse ja kuidas neid hallata.",
    "See täiendab [Privaatsuspoliitikat](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Mis on küpsised",
      paragraphs: [
        "Küpsised on väikesed tekstifailid, mida veebisait Teie brauseris salvestab. Sarnased tehnoloogiad on brauseri kohalik salvestusruum ja jälgimispikslid e-kirjades.",
        "Küpsiseid, mis on Platvormi toimimiseks hädavajalikud, tohime seada ilma Teie nõusolekuta. Kõigi ülejäänute jaoks küsime Teie nõusolekut (direktiivi 2002/58/EÜ artikli 5 lõige 3).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Vajalikud küpsised",
      paragraphs: [
        "Need küpsised on toimimiseks vajalikud ja neid ei saa välja lülitada. Kasutame praegu:",
      ],
      list: [
        "„nd_access“ – hoiab Teie sisselogimist. Loetav üksnes serverile (HttpOnly), kestus vastab seansi kehtivusele.",
        "„nd_refresh“ – uuendab Teie sisselogimist, et Te ei peaks pidevalt uuesti sisse logima. Loetav üksnes serverile, kestus 30 päeva.",
        "„nd_gast_locale“ – jätab meelde Teie valitud keele. Kestus üks aasta.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Funktsionaalsed, statistika- ja turundusküpsised",
      paragraphs: [
        "myBestDays ei kasuta praegu küpsiseid statistika, leviulatuse mõõtmise ega reklaami jaoks ega manusta reklaamivõrke ega analüüsiteenuseid.",
        "Kui see muutub, küsime eelnevalt Teie nõusolekut valikudialoogi kaudu, kus keeldumine on sama lihtne kui nõustumine, ja täiendame käesolevat poliitikat konkreetsete küpsistega.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Kolmandate isikute manustatud sisu",
      paragraphs: [
        "Detaililehtedel võivad olla manustatud kaardid. Sellist sisu laadime alles siis, kui selle sõnaselgelt aktiveerite; alles siis saab andmeid edastada vastavale pakkujale.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Kuidas küpsiseid hallata",
      paragraphs: [
        "Oma nõusolekut võite igal ajal muuta või tagasi võtta jaluses olevate küpsiseseadete kaudu.",
        "Lisaks võite küpsiseid oma brauseris kustutada või blokeerida. Kui kustutate vajalikud küpsised, logitakse Teid välja ja Platvorm toimib piiratult.",
      ],
    },
  ],
};
