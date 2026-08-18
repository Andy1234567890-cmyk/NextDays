import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Sobiva sisu reeglid",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Käesolevad reeglid kehtivad kogu sisule, mida kasutajad myBestDays-is avaldavad: kuulutused, fotod, arvustused, sõnumid, profiiliandmed ja vastused arvustustele.",
    "Need on [Kasutustingimuste](https://mybestdays.dk/rechtliches/nutzungsbedingungen) osa. Rikkumine võib viia sisu eemaldamiseni ja meetmeteni konto vastu.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Mis ei ole lubatud",
      paragraphs: ["myBestDays-is on lubamatu eelkõige järgmine sisu:"],
      list: [
        "igasugune õigusvastane sisu, eelkõige üleskutsed kuritegudele, terroristlik sisu ja laste seksuaalse kuritarvitamise kujutised;",
        "sisu, mis õhutab vihkamisele või vägivallale isikute või rühmade vastu päritolu, nahavärvi, usutunnistuse, veendumuste, soo, sooidentiteedi, seksuaalse sättumuse, puude või vanuse tõttu;",
        "solvangud, ähvardused, ahistamine ja üksikisikute sihipärane häbistamine;",
        "kolmandate isikute isikuandmed ilma nende nõusolekuta, eelkõige nimed, aadressid, telefoninumbrid, isikut tõendava dokumendi või makseandmed;",
        "eksitavad andmed majutuskoha, selle asukoha, sisustuse, suuruse või saadavuse kohta;",
        "võõrad fotod, tekstid või kaubamärgid ilma vajalike õigusteta;",
        "reklaam, rämpspost ja sisu, mis suunab muudele broneerimisteedele väljaspool Platvormi;",
        "pahavara, andmepüügikatsed ja lingid sellisele sisule;",
        "kuulutused millegi muu kui majutusteenuse kohta.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Fotod",
      paragraphs: [
        "Fotod peavad kujutama tegelikult pakutavat majutuskohta ja olema tehtud seisukorras, mis vastab tänasele.",
        "Fotodel ei tohi olla äratuntavaid isikuid ilma nende nõusolekuta. Töötlemine on lubatud niivõrd, kuivõrd see ei moonuta muljet majutuskohast – heledamaks muutmine jah, retušitud naaberhoone ei.",
        "Kaameravalve majutuskohas tuleb kuulutuses avaldada. Siseruumides, kus külalistel on õigustatud privaatsusootus – magamistoad, vannitoad – ei ole kaamerad lubatud, ka väljalülitatuna mitte.",
      ],
    },
    {
      id: "melden",
      heading: "3. Sisust teatamine",
      paragraphs: [
        "Kui peate sisu õigusvastaseks või käesolevate reeglite rikkumiseks, võite sellest teatada iga kuulutuse, iga arvustuse ja iga sõnumi juures oleva teatamisfunktsiooni kaudu.",
        "Teatamismenetlus määruse (EL) 2022/2065 artikli 16 kohaselt ja teadete menetlemine on kirjeldatud jaotises [Digiteenuste õigusakt](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Kuidas reegleid jõustame",
      paragraphs: [
        "Kontrollime iga teatatud sisu ja valime kõige leebema sobiva meetme: märkuse, asjaomase osa eemaldamise, kogu sisu eemaldamise, nähtavuse piiramise, funktsiooni blokeerimise või konto blokeerimise.",
        "Korduvad või rasked rikkumised kaaluvad rohkem. Ilmselgelt õigusvastase sisu või inimeste ohustamise korral tegutseme kohe.",
        "Iga meetme põhjendame asjaomasele isikule ja juhime tähelepanu kaebeteele. Kaebust menetlevad inimesed.",
      ],
    },
  ],
};
