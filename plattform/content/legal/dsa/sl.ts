import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Akt o digitalnih storitvah",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "myBestDays je posredniška storitev in spletna platforma v smislu Uredbe (EU) 2022/2065 o enotnem trgu digitalnih storitev (akt o digitalnih storitvah, DSA). Ta stran združuje podatke in postopke, ki jih ta uredba zahteva.",
    "myBestDays ni zelo velika spletna platforma v smislu člena 33 uredbe. Dodatne obveznosti, ki iz tega izhajajo — ugotavljanje sistemskih tveganj, neodvisna revizija, arhiv oglasov in objava mesečnega števila uporabnikov po tam predvidenem postopku — nas zato ne zadevajo.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Kontaktne točke (člena 11 in 12)",
      paragraphs: [
        `Enotna kontaktna točka za organe držav članic, Komisijo in Evropski odbor za digitalne storitve: ${ANBIETER.email}, po pošti ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danska.`,
        `Enotna kontaktna točka za uporabnike: ${ANBIETER.email}. Do nas pridete neposredno in brez avtomatiziranega vmesnega koraka.`,
        "Z obema kontaktnima točkama je mogoče komunicirati v nemščini, danščini in angleščini.",
        "Pravnega zastopnika v Uniji po členu 13 ni treba imenovati: upravljavec ima sedež na Danskem in s tem v Uniji.",
        `Pristojni koordinator digitalnih storitev po členu 49: ${DSA_KOORDINATOR.name}, Danska ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Prijava protipravne vsebine (člen 16)",
      paragraphs: [
        "Vsakdo nam lahko prijavi vsebino, za katero meni, da je protipravna. Uporabite funkcijo prijave, ki je na voljo pri vsakem oglasu, vsaki oceni in vsakem sporočilu, ali kontaktno točko za uporabnike.",
        "Da lahko prijavo presodimo brez poglobljene pravne presoje, naj vsebuje:",
      ],
      list: [
        "zadostno obrazloženo pojasnilo, zakaj je vsebina protipravna;",
        "natančno elektronsko lokacijo, zlasti naslov URL;",
        "ime in e-naslov prijavitelja — razen pri prijavah kaznivih dejanj zoper spolno nedotakljivost otrok, kjer je ta navedba prostovoljna;",
        "izjavo, da so podatki po najboljšem vedenju pravilni in popolni.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Kako obravnavamo prijave",
      paragraphs: [
        "Prejem nemudoma potrdimo in odločimo pravočasno, skrbno, nearbitrarno in objektivno.",
        "Če prijava vsebuje podatke iz razdelka 2, utemeljuje našo vednost v smislu člena 6 uredbe.",
        "O svoji odločitvi obvestimo prijavitelja in ga poučimo o pravnih sredstvih.",
        "Ob avtomatizirani obravnavi to sporočimo.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Obrazložitev ukrepov (člen 17)",
      paragraphs: [
        "Če omejimo vidnost vsebine, jo odstranimo, blokiramo dostop do nje, začasno ustavimo plačila, opravljanje storitve ali račun, prizadeta oseba prejme jasno in konkretno obrazložitev.",
        "Obrazložitev navaja vrsto in obseg ukrepa, njegovo krajevno in časovno veljavnost, dejstva in okoliščine odločitve, ali je bila vpletena avtomatizirana obdelava, pravno podlago ali kršeno pogodbeno določilo ter razpoložljiva pravna sredstva.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Sum kaznivega dejanja (člen 18)",
      paragraphs: [
        "Če obstajajo znaki kaznivega dejanja, ki pomeni nevarnost za življenje ali varnost osebe, nemudoma obvestimo pristojne organe pregona ali pravosodne organe.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Interni pritožbeni postopek (člen 20)",
      paragraphs: [
        "Zoper vsak ukrep iz razdelka 4 in zoper zavrnitev prijave je mogoče v šestih mesecih brezplačno vložiti pritožbo.",
        "Pritožbe obravnavamo pravočasno, nediskriminatorno in skrbno — pod nadzorom usposobljenih oseb in ne izključno z avtomatiziranimi sredstvi.",
        "Če se pritožba izkaže za utemeljeno, ukrep umaknemo. Pot opisuje razdelek [Pritožbe in reševanje sporov](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Izvensodno reševanje sporov (člen 21)",
      paragraphs: [
        "Za spore o ukrepih iz razdelka 4 se uporabniki lahko obrnejo na organ za izvensodno reševanje sporov, ki ga je certificiral pristojni koordinator digitalnih storitev. Seznam certificiranih organov vodi Evropska komisija.",
        "Odločitve teh organov za nas niso zavezujoče; k sodelovanju v postopkih neodvisnih ponudnikov nismo zavezani. Pot do sodišč ostaja nedotaknjena.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Zaupanja vredni prijavitelji (člen 22)",
      paragraphs: [
        "Prijave, ki jih vloži subjekt, priznan kot zaupanja vreden prijavitelj na svojem strokovnem področju, obravnavamo prednostno.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Ukrepi zoper zlorabe (člen 23)",
      paragraphs: [
        "Račune, prek katerih se pogosto zagotavlja očitno protipravna vsebina, po predhodnem opozorilu za primeren čas blokiramo.",
        "Obravnavo prijav in pritožb začasno ustavimo za osebe, ki pogosto vlagajo očitno neutemeljene prijave ali pritožbe — prav tako po predhodnem opozorilu.",
        "Pri tem vedno presojamo posamezen primer: število, delež in težo zadevnih ravnanj ter namen.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Poročila o preglednosti (člena 15 in 24)",
      paragraphs: [
        "Letno objavljamo poročilo o moderiranju vsebine: število odredb organov, število in vrsto prijav, sprejete ukrepe, število pritožb in njihov izid, podatke o uporabi avtomatiziranih postopkov ter število sporov pred izvensodnimi organi.",
        `Mikropodjetja in mala podjetja so po členu 19 uredbe oproščena dela teh obveznosti. Dokler oprostitev velja, podatke na zahtevo zagotovimo na naslovu ${ANBIETER.email}; takoj ko bo prvo poročilo objavljeno, bo tukaj povezano.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Sledljivost trgovcev (členi 30 do 32)",
      paragraphs: [
        "Ponudniki, ki na Platformi nastopajo v okviru svoje poslovne dejavnosti, smejo ponujati šele, ko so nam posredovali ime, naslov, telefonsko številko, e-naslov, podatke iz registra, identifikacijsko številko za DDV in plačilni račun ter so njihovi podatki verjetni.",
        "Te podatke prikažemo v oglasu, kolikor uredba to predvideva.",
        "Če izvemo, da se je oglas nanašal na protipraven izdelek ali protipravno storitev, obvestimo prizadete goste, kolikor imamo njihove kontaktne podatke.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Priporočilni sistemi (člen 27)",
      paragraphs: [
        "Glavni parametri vrstnega reda rezultatov iskanja in priporočil ter možnost, da nanje vplivate, so opisani v razdelku [Cene, razvrščanje in priporočila](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Oglaševanje (člen 26)",
      paragraphs: [
        "Trenutno ne prikazujemo plačanega oglaševanja tretjih oseb in ne plačanih umestitev v rezultatih iskanja.",
        "Če bomo uvedli oglaševanje, ga bomo jasno označili, navedli oglaševalca in glavne parametre prikazovanja. Oglaševanje na podlagi posebnih vrst osebnih podatkov po členu 9 Uredbe (EU) 2016/679 in oglaševanje mladoletnim na podlagi oblikovanja profilov izključujemo.",
      ],
    },
  ],
};
