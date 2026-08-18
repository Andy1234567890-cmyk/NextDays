import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Cene, razvrščanje in priporočila",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "Ta stran pojasnjuje, kako so na myBestDays prikazane cene, po čem se ravna vrstni red rezultatov iskanja in kako nastajajo priporočila. Izpolnjuje obveznosti glede preglednosti iz člena 6a Direktive 2005/29/ES, člena 5 Uredbe (EU) 2019/1150 in člena 27 Uredbe (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Kako so prikazane cene",
      paragraphs: [
        "Takoj ko sta obdobje in število potnikov znana, prikažemo skupno ceno za celotno bivanje, vključno z davki in vsemi pristojbinami, obračunanimi prek Platforme.",
        "Dokler obdobje ni izbrano, prikazujemo ceno na noč kot orientacijo in jo tako označimo.",
        "Stroške, ki nastanejo šele na kraju samem, prikažemo ločeno pred zaključkom rezervacije. Niso del skupne cene, so pa pred rezervacijo vidni.",
        "Če prikažemo prečrtano primerjalno ceno, je to najnižja cena, ki jo je ponudnik za isto storitev zahteval v zadnjih 30 dneh pred znižanjem (člen 6a Direktive 98/6/ES).",
        "Cene so za vse goste enake. Cene ne prilagajamo vaši osebi, vaši napravi ali vašemu dosedanjemu iskalnemu vedenju.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Po čem se ravna vrstni red rezultatov iskanja",
      paragraphs: [
        "Pri privzetem razvrščanju vrstni red določajo naslednje značilnosti, po padajočem pomenu:",
      ],
      list: [
        "ujemanje z vašim iskanjem — razpoložljivost v iskanem obdobju, zmogljivost za število potnikov, lega na iskanem območju in nastavljeni filtri;",
        "popolnost in kakovost oglasa — opis, fotografije, urejeni podatki o opremi;",
        "ocene — skupna ocena in število ocen;",
        "zanesljivost ponudnika — odzivnost, delež sprejetih povpraševanj in odpovedi s strani ponudnika;",
        "ažurnost cen in razpoložljivosti;",
        "razmerje med ceno in kakovostjo v primerjavi s podobnimi oglasi na istem območju.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Plačana umestitev",
      paragraphs: [
        "Ponudnik si ne more kupiti boljšega mesta v privzetem razvrščanju. Višina storitvene pristojbine na vrstni red ne vpliva.",
        "Če bomo v prihodnje ponujali plačane umestitve, jih bomo nedvoumno označili kot oglas in jih vidno ločili od preostalih rezultatov.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Sprememba razvrščanja",
      paragraphs: [
        "Razvrščanje lahko kadar koli spremenite, na primer po ceni ali oceni. Katero razvrščanje je aktivno, je prikazano nad seznamom rezultatov.",
        "Na voljo vam je vsaj eno razvrščanje, ki ne temelji na oblikovanju profilov v smislu člena 4, točke 4 Uredbe (EU) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Priporočila",
      paragraphs: [
        "Če vam prikazujemo predloge (»morda vam bo všeč«, »podobne nastanitve«), ti temeljijo na trenutnem iskanju, na predhodno ogledanih oglasih in na značilnostih podobnih nastanitev.",
        "Prilagojena priporočila lahko v svojem računu izklopite. Nato boste videli predloge, ki temeljijo izključno na trenutnem iskanju.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Ocene pri razvrščanju",
      paragraphs: [
        "Kako ocene nastajajo in kako se preverjajo, je navedeno v [Politiki ocen](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Ocene vplivajo na vrstni red, vendar posameznih ocen ne utežimo višje niti negativnih ne zatiramo.",
      ],
    },
  ],
};
