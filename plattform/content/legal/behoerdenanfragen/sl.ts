import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika za zahteve organov in organov pregona",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ta politika je namenjena organom, sodiščem in organom pregona, ki od myBestDays zahtevajo podatke ali naslovijo odredbo zoper vsebino. Tukaj je javna, da lahko tudi uporabniki preberejo, pod katerimi pogoji podatke izdajamo.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Načelo",
      paragraphs: [
        "Podatke uporabnikov izdamo le, kadar obstaja veljavna pravna podlaga in zahteva izpolnjuje formalne zahteve. Neformalna prošnja za podatke ne zadostuje.",
        "Vsako zahtevo preverimo glede pristojnosti, pravne podlage, določnosti in sorazmernosti ter izdamo le podatke, ki jih zahteva navaja.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Zahteve glede vloge",
      paragraphs: ["Zahteva naj vsebuje:"],
      list: [
        "organ prosilec, opravilno številko in kontaktne podatke osebe, ki zadevo obravnava, na uradnem dopisu;",
        "pravno podlago po nacionalnem pravu ali pravu Unije;",
        "natančno navedbo prizadete osebe ali prizadetega računa — e-naslov, številko rezervacije ali naslov URL oglasa;",
        "natančno navedene podatke in obdobje;",
        "po potrebi sodno odredbo, kolikor jo pravo, ki se uporablja, zahteva;",
        "opozorilo, če bi obvestitev prizadete osebe ogrozila preiskavo, z navedbo pravne podlage.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Odredbe po Uredbi (EU) 2022/2065",
      paragraphs: [
        "Odredbe za ukrepanje zoper protipravno vsebino (člen 9) in odredbe za zagotovitev informacij (člen 10) morajo vsebovati tam navedene podatke, zlasti pravno podlago, natančno elektronsko lokacijo, obrazložitev, pravna sredstva in jezik.",
        "Prejem potrdimo in organu, ki je odredbo izdal, sporočimo, katere ukrepe smo sprejeli in kdaj.",
        "O odredbi obvestimo prizadeto osebo najpozneje ob izvedbi, razen če organ z navedbo pravne podlage odredi odlog.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Nujni primeri",
      paragraphs: [
        "Če obstaja neposredna nevarnost za življenje ali telesno celovitost, podatke, potrebne za njeno odvrnitev, izdamo tudi brez predhodne formalne odredbe. Tako zahtevo izrecno označite kot nujno in opišite nevarnost.",
        "Če obstajajo znaki kaznivega dejanja, ki pomeni nevarnost za življenje ali varnost osebe, pristojne organe obvestimo na lastno pobudo (člen 18 Uredbe (EU) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Katere podatke hranimo",
      paragraphs: [
        "Katere kategorije podatkov obdelujemo in kako dolgo jih hranimo, je navedeno v [Politiki zasebnosti](https://mybestdays.dk/rechtliches/datenschutz). Nad tam navedenimi roki podatkov ne hranimo.",
        "Hrambe podatkov nad potrebo ne izvajamo. Poziv k začasni zavarovanju podatkov za tekoči postopek izvedemo v pravno dopustnem okviru.",
        "Popolnih plačilnih podatkov nimamo; treba jih je zahtevati pri ponudniku plačilnih storitev.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Obvestitev prizadete osebe",
      paragraphs: [
        "Prizadete uporabnike o zahtevi, ki zadeva njihove podatke, obvestimo, razen če to prepoveduje pravni predpis ali obrazložena odredba organa oziroma obstaja neposredna nevarnost za življenje ali telesno celovitost.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Kam nasloviti zahteve",
      paragraphs: [
        "Zahteve naslovite na enotno kontaktno točko za organe, navedeno v razdelku [Akt o digitalnih storitvah](https://mybestdays.dk/rechtliches/dsa). Obravnavamo jih v nemščini in angleščini.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Preglednost",
      paragraphs: [
        "Število in vrsto odredb organov navajamo v svojem letnem poročilu o preglednosti; glej [Akt o digitalnih storitvah](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
