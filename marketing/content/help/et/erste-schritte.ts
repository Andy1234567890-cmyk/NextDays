import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Esimesed sammud",
  description: "Seadistage konto ja alustage töötamist mõne minutiga.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Seadistamine",
      articles: [
        {
          slug: "willkommen",
          title: "Tere tulemast myNextDays'i",
          excerpt: "Ülevaade PMS-ist, kanalihaldurist, turuplatsist ja rakendusest.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays on Teie keskne platvorm puhkemajutuste ja hotellide jaoks. Selle asemel, et kasutada mitut eraldiseisvat lahendust, haldate saadavust, hindu, broneeringuid ja külalistega suhtlust ühest kohast — olgu Teil siis üks puhkemaja või mitu hotellituba.",
            },
            { type: "h2", text: "Neli põhikomponenti" },
            {
              type: "ul",
              items: [
                "PMS (kinnisvarahaldussüsteem): objektid, kalender, hinnad, broneeringud, ülesanded ja maksed.",
                "Kanalihaldur: ühendus portaalidega nagu Booking, Airbnb & Co. — üks sisestus, mitu portaali sünkroonis.",
                "Platvormi turuplats: oma myBestDays'i turuplats, võrdväärne broneerimiskanal koos portaalidega.",
                "Rakendus: mobiilirakendus külalistele, omanikele ja töötajatele — samade andmetega mis veebis.",
              ],
            },
            { type: "h2", text: "Kuidas komponendid koos toimivad" },
            {
              type: "p",
              text: "Objekti, hindu ja saadavust hooldate üks kord tsentraalselt PMS-is. Sealt jagab myNextDays andmed automaatselt kõikidele aktiivsetele kanalitele. Broneering — olenemata sellest, mille kaudu see sisse tuleb — blokeerib kohe vastavad ööd kõikjal, nii et topeltbroneeringud on välistatud.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Alustage sammust Konto ja ettevõtte seadistamine, seejärel looge oma esimene objekt — see järjekord säästab hiljem parandusi.",
            },
            { type: "h2", text: "Järgmised sammud" },
            {
              type: "steps",
              items: [
                "Avage menüüst Konto ja täiendage oma ettevõtte andmeid.",
                "Looge Objektid all oma esimene objekt.",
                "Kontrollige varustuse, fotode ja hindade täielikkust.",
                "Klõpsake Avalda, et teha objekt nähtavaks kõikidel kanalitel.",
              ],
            },
            {
              type: "p",
              text: "Rohkem üksikute sammude kohta leiate artiklitest [Konto ja ettevõtte seadistamine](/hilfe/erste-schritte/konto-einrichten) ja [Looge oma esimene objekt](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Konto ja ettevõtte seadistamine",
          excerpt: "Sisestage õigesti põhiandmed, arve aadress ja valuuta.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Enne objektide loomist seadistage oma ettevõte Konto alt. Neid andmeid on vaja arvete, portaalide ja myNextDays'iga arveldamise jaoks, seega peaksid need olema täielikud ja korrektsed.",
            },
            { type: "h2", text: "Põhiandmete sisestamine" },
            {
              type: "steps",
              items: [
                "Avage menüüst Konto.",
                "Sisestage Põhiandmed all ettevõtte nimi või füüsilisest isikust ettevõtja nimi, aadress ja kontaktandmed.",
                "Sisestage arve aadress — see kuvatakse kõikidel väljastatud arvetel.",
                "Valige oma põhivaluuta. See kehtib kõikidele hindadele, kuni muudate seda eraldi konkreetse objekti puhul.",
              ],
            },
            { type: "h2", text: "Miks valuuta on oluline" },
            {
              type: "p",
              text: "Valuutat ei arvata ega täiendata automaatselt: kui see puudub, ei saa ühtegi hinda korrektselt kuvada ega arveldada. Seetõttu nõuab myNextDays seadistamisel teadlikku valikut, mitte ei sisesta vaikeväärtust.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Kui muudate objekti valuutat hiljem, muudetakse kõik sellega seotud hinnaplaanid samuti. Kontrollige pärast seda hindu üle.",
            },
            { type: "h2", text: "Arve aadress ja arveldamine" },
            {
              type: "p",
              text: "Konto all Arveldamine näete oma jooksvaid arveid ja salvestatud arve aadressi. Hoidke need ajakohasena, eriti õigusliku vormi või aadressi muutuse korral, et arved väljastataks korrektselt.",
            },
            {
              type: "ul",
              items: [
                "Ettevõtte nimi või füüsilisest isikust ettevõtja nimi",
                "Arve aadress koos riigiga",
                "Maksu- või käibemaksukohustuslase number, kui olemas",
                "Uute objektide põhivaluuta",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Looge oma esimene objekt",
          excerpt: "Samm-sammult juhend esimese broneeritava objekti loomiseks.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Objekt myNextDays'is on alati täpselt üks broneeritav üksus: kas üks tuba hotellis või terve puhkemajutusobjekt. Kui haldate mitme toaga hotelli, looge iga toa jaoks eraldi objekt.",
            },
            { type: "h2", text: "Objekti loomine" },
            {
              type: "steps",
              items: [
                "Avage menüüst Objektid.",
                "Klõpsake Lisa objekt.",
                "Valige objekti tüüp: kategooria, kinnisvara tüüp ja pakkumise liik.",
                "Täiendage aadress, mahutavus ja põhihind Teie salvestatud valuutas.",
                "Salvestage objekt mustandina, et see hiljem lõpetada.",
              ],
            },
            { type: "h2", text: "Mis veel puudu on" },
            {
              type: "p",
              text: "Äsja loodud objekt on esialgu mustand ega ole nähtav ühelgi kanalil. Täiendage varustust, fotosid, kirjeldust ja kalendri saadavust enne avaldamist — ainult täielik objekt on usaldusväärselt turustatav.",
            },
            {
              type: "ul",
              items: [
                "Valige varustuse tunnused kategooria nimekirjast",
                "Lisage vähemalt üks tiitelfoto ja kirjeldus",
                "Sisestage mahutavus (täiskasvanud, lapsed, voodid) korrektselt",
                "Kontrollige põhihinda ja kalendri saadavust",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kui haldate mitut toa tüüpi, korrake seda protsessi iga üksiku toa jaoks — ülemist hoone taset tubadega selle all ei ole.",
            },
            {
              type: "p",
              text: "Kui kõik kohustuslikud väljad on täidetud, saate objekti avaldada, vt [Objekti avaldamine](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Objekti avaldamine",
          excerpt: "Üks klõps aktiveerib korraga platvormi turuplatsi, portaalid ja veebilehe.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "Avaldamine teeb objekti nähtavaks ja broneeritavaks. Tavaliselt piisab ühest klõpsust, et aktiveerida kõik kolm müügikanalit korraga — kuid saate nähtavust igal ajal iga kanali kaupa eraldi kohandada.",
            },
            { type: "h2", text: "Kuidas avaldada" },
            {
              type: "steps",
              items: [
                "Avage objekt Objektid all.",
                "Kontrollige vahekaardil Ülevaade, kas kõik kohustuslikud andmed on rohelisega märgitud.",
                "Klõpsake Avalda.",
                "Kinnitage dialoog — platvormi turuplats, portaalid ja veebileht aktiveeritakse.",
              ],
            },
            { type: "h2", text: "Kanalite eraldi juhtimine" },
            {
              type: "p",
              text: "Pärast avaldamist leiate vahekaardilt Nähtavus kolm eraldi lülitit: veebileht, platvormi turuplats ja portaalid. Kui soovite näiteks pakkuda objekti ainult oma veebilehel, kuid mitte portaalide kaudu, lülitage lihtsalt vastav lüliti välja.",
            },
            {
              type: "ul",
              items: [
                "Veebileht: nähtavus Teie enda myNextDays veebilehel",
                "Platvormi turuplats: nähtavus globaalsel myBestDays turuplatsil",
                "Portaalid: nähtavus Booking, Airbnb & Co. juures",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Need kolm lülitit ei sõltu objekti olekust (aktiivne/mitteaktiivne). Aktiivne objekt võib siiski olla üksikutel kanalitel nähtamatu.",
            },
            { type: "h2", text: "Objekti ajutine sulgemine" },
            {
              type: "p",
              text: "Kui soovite sulgeda ühe päeva, mitte kogu objekti, kasutage kalendris funktsiooni Müügipeatus — see blokeerib päeva korraga kõikidel kanalitel, sõltumata nähtavuse lülititest.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Kolme müügikanali mõistmine",
          excerpt: "Ülevaade portaalidest, platvormi turuplatsist ja rakendusest.",
          updated: "Uuendatud: juuli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays turustab iga objekti mitme võrdväärse kanali kaudu korraga. Nende koostoime mõistmine aitab Teil nähtavust ja hindu sihipäraselt juhtida.",
            },
            { type: "h2", text: "Portaalid" },
            {
              type: "p",
              text: "Kanalihalduri kaudu ühendate oma objekti suurte broneerimisportaalidega nagu Booking, Airbnb & Co. Saadavus ja hinnad sünkroonitakse automaatselt, nii et Te ei pea mitut portaali kalendrit käsitsi hooldama.",
            },
            { type: "h2", text: "Platvormi turuplats" },
            {
              type: "p",
              text: "myBestDays'i turuplats on oma, globaalne broneerimiskanal — võrreldav Bookingu või Airbnb'ga, kuid osa samast platvormist. See ei ole „otsebroneerimise“ asendaja, vaid võrdväärne kanal oma nähtavuse teljega.",
            },
            { type: "h2", text: "Rakendus" },
            {
              type: "p",
              text: "Mobiilirakendus pakub külalistele, omanikele ja töötajatele juurdepääsu samadele andmetele mis veebis — näiteks broneeringu detailid, sõnumid või ülesanded, olenevalt vastavast rollist.",
            },
            { type: "h2", text: "Kolm eraldi nähtavuse telge" },
            {
              type: "ul",
              items: [
                "Veebileht — Teie enda myNextDays veebileht",
                "Platvormi turuplats — globaalne myBestDays turuplats",
                "Portaalid — Booking, Airbnb & Co. kanalihalduri kaudu",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kõiki kolme telge saab sisse-välja lülitada üksteisest sõltumatult. Müügipeatus ja objekti olek mõjutavad seevastu kõiki kolme korraga, üle kõikide kanalite.",
            },
          ],
        },
      ],
    },
  ],
};
