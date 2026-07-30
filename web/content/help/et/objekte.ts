import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Objektid ja varustus",
  description: "Toad ja puhkemajutused loomine ja haldamine.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Objektide haldamine",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Objekt = üks broneeritav üksus",
          excerpt: "Miks iga objekt myNextDays'is on täpselt üks broneeritav üksus.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays'is on objekt alati täpselt üks broneeritav üksus — üks tuba hotellis või terve puhkemajutusobjekt. See põhimõte kehtib olenemata sellest, kas haldate puhkemaja, puhkekorterit või hotelli, ja on aluseks saadavusele, hindadele ja broneeringutele.",
            },
            { type: "h2", text: "Mitte hoone tubadega selle all" },
            {
              type: "p",
              text: "Levinud arusaamatus on kujutada hotellihoonet ühe objektina, mille all on mitu tuba. myNextDays'is see nii ei ole. Kui haldate näiteks hotelli kaheksa kahekohalise ja nelja ühekohalise toaga, looge kaksteist eraldi objekti — mitte üks objekt tubade arvuga.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Väljal „tubade arv“ objekti tasandil pole teadlikult olemas. Igal toal peab olema oma objekt oma kalendri ja oma hindadega.",
            },
            { type: "h2", text: "Puhkemajutused" },
            {
              type: "p",
              text: "Puhkemaja või puhkekorteri puhul vastab kogu objekt broneeritavale üksusele. Siin ei ole täiendavat jaotust — puhkemajutus on alati iseseisev objekt oma kalendriga.",
            },
            { type: "h2", text: "Miks see oluline on" },
            {
              type: "ul",
              items: [
                "Igal objektil on oma saadavuse kalender — topeltbroneeringud välditakse objektipõhiselt.",
                "Hinnad, varustus ja fotod kehtivad objekti, mitte hoone kohta.",
                "Objekt kuulub alati täpselt ühele omanikule — mitmikomistus ei ole lubatud.",
                "Kanali nähtavust (veebileht, platvormi turuplats, portaalid) juhitakse objekti kaupa.",
              ],
            },
            {
              type: "p",
              text: "Kuidas valida oma toale või puhkemajutusele sobiv objekti tüüp, lugege artiklist [Objekti tüübi määramine](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Objekti tüübi määramine",
          excerpt: "Kategooria, kinnisvara tüüp ja pakkumise liik korrektselt seada.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Objekti tüüp määrab, kuidas Teie objekt portaalidel ja platvormi turuplatsil liigitatakse ja filtreeritakse. See koosneb kolmest üksteisele üles ehitatud valikuväljast, mida läbite objekti loomisel või muutmisel.",
            },
            { type: "h2", text: "Kolm valikutasandit" },
            {
              type: "steps",
              items: [
                "Valige kõigepealt kategooria — näiteks puhkemajutus või hotell.",
                "Valige selle põhjal kinnisvara tüüp — näiteks puhkekorter, puhkemaja, kahekohaline tuba või ühekohaline tuba.",
                "Valige pakkumise liik — näiteks terve objekt või privaattuba.",
                "Täiendage valikust olenevalt kuvatavad lisaväljad, näiteks voodi tüüp või korrus.",
              ],
            },
            { type: "h2", text: "Miks järjekord on oluline" },
            {
              type: "p",
              text: "Kolm rippmenüüd sõltuvad üksteisest: kategooria valik piirab saadaolevaid kinnisvara tüüpe, kinnisvara tüübi valik omakorda pakkumise liike. Nii tekivad ainult mõistlikud kombinatsioonid, nagu neid kasutatakse ka suurtel portaalidel.",
            },
            {
              type: "note",
              variant: "info",
              text: "Kui muudate kategooriat hiljem, kontrollib myNextDays, kas kinnisvara tüüp ja pakkumise liik veel sobivad, ning palub vajadusel uut valikut.",
            },
            { type: "h2", text: "Objekti tüübi muutmine" },
            {
              type: "p",
              text: "Avage menüüst Objektid soovitud objekt ja liikuge vahekaardile Põhiandmed. Seal leiate kolm rippmenüüd Objekti tüübi all. Kui salvestate muudatuse, edastatakse uus liigitus kõikidele aktiivsetele kanalitele.",
            },
            {
              type: "ul",
              items: [
                "Kategooria: ülemine liigitus (nt puhkemajutus, hotell)",
                "Kinnisvara tüüp: konkreetne objekti tüüp (nt puhkekorter, kahekohaline tuba)",
                "Pakkumise liik: mis täpselt broneeritakse (nt terve objekt, privaattuba)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Varustuse haldamine",
          excerpt: "Valige varustuse tunnused ja hoidke need ajakohasena.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Objekti varustus mõjutab oluliselt, kui hästi see portaalidel leitav ja filtreeritav on. Külalised filtreerivad sihipäraselt tunnuste järgi nagu WiFi, köök või parkimiskoht — puuduvad andmed võivad objekti otsingutulemustest välja jätta.",
            },
            { type: "h2", text: "Varustuse valimine" },
            {
              type: "steps",
              items: [
                "Avage objekt ja liikuge vahekaardile Varustus.",
                "Valige kõik sobivad tunnused etteantud nimekirjast.",
                "Täiendage vajadusel detaile, nagu parkimiskohtade arv või köögi liik.",
                "Salvestage muudatused — need edastatakse automaatselt kõikidele aktiivsetele portaalidele.",
              ],
            },
            { type: "h2", text: "Kust tunnused pärinevad" },
            {
              type: "p",
              text: "Varustuse nimekiri järgib suurte portaalide tunnuste kataloogi, et Teie andmed saaksid seal korrektselt seostatud. Iseseisvalt väljamõeldud tunnuseid ei ole ette nähtud, kuna neid ei saaks portaalidele puhtalt üle kanda.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kontrollige varustust pärast igat ehituslikku muudatust — näiteks uut kliimaseadet või lisavannituba —, et andmed jääksid kõikidel kanalitel ajakohaseks.",
            },
            { type: "h2", text: "Levinud tunnuste rühmad" },
            {
              type: "ul",
              items: [
                "Põhivarustus: WiFi, küte, kliimaseade",
                "Köök ja toitlustus: täisvarustusega köök, nõudepesumasin, kohvimasin",
                "Vannituba ja pesu: oma vannituba, pesumasin, käterätikud",
                "Välisala: rõdu, terrass, aed, parkimiskoht",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Fotod ja kirjeldus",
          excerpt: "Sisukad pildid ja tekstid rohkemate broneeringute jaoks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Fotod ja kirjeldus on külaliste jaoks kõige olulisem otsustusalus. Objekti saab avaldada alles siis, kui vähemalt üks tiitelfoto ja kirjeldus on sisestatud.",
            },
            { type: "h2", text: "Fotode üleslaadimine" },
            {
              type: "steps",
              items: [
                "Avage objekt ja liikuge vahekaardile Fotod.",
                "Lohistage pildifailid üleslaadimisalasse või valige need failidialoogi kaudu.",
                "Määrake tiitelfoto — see kuvatakse otsingutulemustes ja kaartides.",
                "Korraldage ülejäänud fotod lohistades mõistlikku järjekorda.",
              ],
            },
            { type: "h2", text: "Kirjelduse koostamine" },
            {
              type: "p",
              text: "Liikuge vahekaardile Kirjeldus ja sisestage pealkiri ning jooksev tekst. Kirjeldage objekti asukohta, eripärasid ja sihtrühma konkreetselt — üldised fraasid mõjuvad portaalidel vähem veenvalt kui käegakatsutavad detailid.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Teiste objektide või internetist pärit fotosid ei tohi kasutada — portaalid kontrollivad seda ja võivad rikkumiste korral objekte sulgeda.",
            },
            { type: "h2", text: "Soovitused heade fotode jaoks" },
            {
              type: "ul",
              items: [
                "Vähemalt viis fotot, ideaaljuhul üks igast ruumist",
                "Rõhtformaat, hea valgustus, ilma vesimärkideta",
                "Tiitelfoto näitab objekti võimalikult kutsuvalt ja üheselt mõistetavalt",
                "Uuendage regulaarselt, eriti pärast renoveerimist",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Täituvus ja mahutavus",
          excerpt: "Maksimaalne külaliste arv ja voodite jaotus korrektselt sisestada.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Täituvus määrab, mitu külalist objekt mahutab, ja seda kontrollitakse iga otsingu ja broneeringu puhul. Valed andmed viivad kas tagasilükatud päringuteni või ülekoormuseni — mõlemat tuleks vältida.",
            },
            { type: "h2", text: "Täituvuse sisestamine" },
            {
              type: "steps",
              items: [
                "Avage objekt ja liikuge vahekaardile Täituvus.",
                "Sisestage maksimaalne täiskasvanute arv.",
                "Sisestage maksimaalne laste arv, kui need on lubatud.",
                "Sisestage voodite jaotus ruumide kaupa, näiteks üks kahekohaline voodi ja kaks ühekohalist voodit.",
              ],
            },
            { type: "h2", text: "Täituvuse piirid" },
            {
              type: "p",
              text: "Broneeringupäringu korral kontrollib myNextDays automaatselt, kas soovitud külaliste arv jääb sisestatud täituvuse piiresse. Päringud, mis ületavad maksimaalset mahutavust, lükatakse tagasi või ei kuvata üldse broneeritavana.",
            },
            {
              type: "note",
              variant: "info",
              text: "Lisavoodi või lastevoodi suurendab tegelikku mahutavust ainult siis, kui sisestate selle otseselt voodite jaotusse — vastasel juhul jääb maksimaalne külaliste arv muutumatuks.",
            },
            { type: "h2", text: "Tüüpilised vigade allikad" },
            {
              type: "ul",
              items: [
                "Maksimaalne külaliste arv seatud liiga kõrgeks, kuigi voodeid on vähe",
                "Laste arv unustatud, kuigi objekt on suunatud peredele",
                "Voodite jaotust ei ole pärast renoveerimist uuendatud",
              ],
            },
            {
              type: "p",
              text: "Kui täituvus ja varustus ei sobi kokku, kontrollige lisaks vahekaarti [Varustus](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Objekti olek ja nähtavus",
          excerpt: "Erinevus aktiivse/mitteaktiivse oleku ja kolme kanali telje vahel.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays eristab kahte sageli segamini aetavat asja: objekti olekut (aktiivne või mitteaktiivne) ja nähtavust üksikutel müügikanalitel. Mõlemat juhite eraldi.",
            },
            { type: "h2", text: "Objekti olek" },
            {
              type: "p",
              text: "Olek active tähendab, et objekt on põhimõtteliselt müügikõlblik. Olek inactive lülitab objekti täielikult käibest välja — näiteks pikaajalise renoveerimise korral. Mitteaktiivne objekt ei ole broneeritav ühelgi kanalil, olenemata kanali lülititest.",
            },
            { type: "h2", text: "Kolm kanali telge" },
            {
              type: "p",
              text: "Kui objekt on aktiivne, otsustavad kolm sõltumatut lülitit, kus täpselt see nähtav on:",
            },
            {
              type: "ul",
              items: [
                "Veebileht — nähtavus Teie enda myNextDays veebilehel",
                "Platvormi turuplats — nähtavus globaalsel myNextDays turuplatsil",
                "Portaalid — nähtavus Booking, Airbnb & Co. juures",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Need kolm telge on täielikult sõltumatud objekti olekust ja üksteisest. Aktiivne objekt võib olla nähtav näiteks ainult veebilehel, kuid mitte portaalidel.",
            },
            { type: "h2", text: "Oleku muutmine" },
            {
              type: "steps",
              items: [
                "Avage objekt ja liikuge vahekaardile Ülevaade.",
                "Seadke olek aktiivseks või mitteaktiivseks.",
                "Kohandage vajadusel lisaks kolme kanali lülitit vahekaardil Nähtavus.",
                "Salvestage muudatus — see mõjutab kohe kõiki puudutatud kanaleid.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Üksikute päevade lühiajaliseks sulgemiseks kasutage selle asemel kalendris funktsiooni Müügipeatus — see blokeerib sihipäraselt päevi kõikidel kanalitel, ilma kogu objekti mitteaktiivseks tegemata.",
            },
          ],
        },
      ],
    },
  ],
};
