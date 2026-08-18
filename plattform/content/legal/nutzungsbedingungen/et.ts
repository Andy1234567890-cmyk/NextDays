import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Kasutustingimused külalistele",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Käesolevad kasutustingimused reguleerivad broneerimisportaali myBestDays (edaspidi „Platvorm“) kasutamist reisijate ja broneerijate poolt (edaspidi „Külaline“ või „Teie“).",
    `Platvormi käitaja on ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Taani, CVR nr ${ANBIETER.cvr} (edaspidi „myBestDays“ või „meie“). myBestDays on selle äriühingu kaubamärk, mitte iseseisev juriidiline isik. Täielikud teenusepakkuja andmed leiate [Õiguslikust teabest](https://mybestdays.dk/rechtliches/impressum).`,
    "Platvormi kasutamisega nõustute käesolevate tingimustega. Palume need tähelepanelikult läbi lugeda.",
  ],
  summary: {
    heading: "Käesolevate tingimuste kokkuvõte",
    paragraphs: [
      "myBestDays on turuplats. Meie pakume Platvormi, kus pakkujad pakuvad oma majutuskohti — majutust ennast meie ei paku. Majutusleping sõlmitakse Teie ja pakkuja vahel, mitte meiega.",
      "See, mida kuulutuses näete, pärineb pakkujalt: kirjeldus, pildid, sisustus, hind, tühistamistingimused ja majareeglid. Kuulutusi kontrollime, kuid me ei saa vastutada iga pakkuja andmete eest.",
      "Hind, mida näete broneeringu lõpetamisel, on broneeritud teenuste kogumaksumus. Täiendavad summad, mis kuuluvad tasumisele alles kohapeal (näiteks kuurordimaks või tagatisraha), toome eelnevalt eraldi välja.",
      "Kui midagi läheb valesti, pöörduge esmalt meie poole. Punkt A15 kirjeldab, kuidas esitada kaebus ja millised teed on Teile seejärel avatud.",
      "Käesolev kokkuvõte selgitab tingimusi, kuid ei asenda neid. Määrav on täistekst.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Kõik broneeringud myBestDays kaudu",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Mõisted",
          paragraphs: [
            "Käesolevates tingimustes kasutatud mõisted on selgitatud dokumendi lõpus olevas sõnastikus. Olulisimad on:",
          ],
          list: [
            "„Platvorm“ – veebisait, mobiilirakendused ja kõik muud juurdepääsuvõimalused, mille kaudu myBestDays kuvab majutuskohti ja vahendab broneeringuid.",
            "„Pakkuja“ – füüsiline või juriidiline isik, kes pakub majutuskohta Platvormi kaudu (võõrustaja, üürileandja, agentuur, hotelli- või majutusettevõte).",
            "„Majutuskoht“ – pakkuja pakutav majutusteenus, st puhkeobjekt või ühe toa- või objektitüübi ühik.",
            "„Broneering“ – Platvormi kaudu sõlmitud majutuskoha broneering kindlaks perioodiks.",
            "„Kogumaksumus“ – broneeringu lõpetamisel näidatud summa, sealhulgas kõik maksud, tasud ja lisatasud, mis arvestatakse Platvormi kaudu.",
            "„Kohapealsed kulud“ – summad, mida ei arvestata Platvormi kaudu, vaid mis kuuluvad tasumisele pakkujale (nt kuurordimaks, tagatisraha, lõppkoristus pakkuja valikul).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. Käesolevatest tingimustest",
          paragraphs: [
            "Käesolevad tingimused kehtivad Platvormi igasugusele kasutamisele, olenemata sellest, kas loote konto ja kas broneering toimub.",
            "Punkt A kehtib kõigile broneeringutele. Punkt B sisaldab täiendavaid reegleid majutuskohtade kohta. Vastuolu korral on ülimuslik punkt B.",
            "Majutusteenusele endale kohaldatakse täiendavalt vastava pakkuja tingimusi (eelkõige majareegleid ja tühistamistingimusi), mis on kuulutuses välja toodud. Need pakkuja tingimused lisanduvad meie omadele; need ei saa meie tingimustest kõrvale kalduda Teie ja meie vahelise suhte osas.",
            "Käesolevad tingimused on kättesaadavad kõigis 24 Euroopa Liidu ametlikus keeles. Keeleversioonide erinevuste korral on määrav saksakeelne versioon, kui Teie elukohariigi imperatiivsed sätted ei näe ette teisiti.",
            "Teie elukohariigi õigusest tulenevad imperatiivsed tarbijaõigused ei ole käesolevate tingimustega mõjutatud.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. myBestDays kohta",
          paragraphs: [
            "myBestDays on veebipõhine turuplats puhkusemajutuse ja majutusettevõtete jaoks. Käitame Platvormi, kus pakkujad esitlevad oma majutuskohti ja külalised saavad neid broneerida.",
            "Oleme vahendaja, mitte majutaja. Me ei oma, ei käita, ei halda ega kontrolli ühtegi Platvormil pakutavat majutuskohta ega ole majutuslepingu pool.",
            "myBestDays on vahendusteenus määruse (EL) 2022/2065 (digiteenuste kohta) tähenduses. Meie sellekohased andmed ja menetlused leiate jaotisest [Digiteenuste õigusakt](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays ei ole reisikorraldaja. Me ei koosta pakettreise direktiivi (EL) 2015/2302 tähenduses; seotud reisikorraldusteenuste kohta vt A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Meie Platvorm",
          paragraphs: [
            "Kuulutuse sisu – kirjeldus, fotod, sisustus, täituvuse piirangud, hinnad, saadavus, tühistamistingimused ja majareeglid – pärineb vastavalt pakkujalt. Pakkuja vastutab selle õigsuse ja täielikkuse eest.",
            "Kuulutusi kontrollime enne avaldamist ja jooksvalt ilmsete meie [Sobiva sisu reeglite](https://mybestdays.dk/rechtliches/inhaltsrichtlinien) rikkumiste suhtes. Kohustust kogu sisu üldiselt jälgida ei ole ja see oleks määruse (EL) 2022/2065 artikli 8 kohaselt ka lubamatu.",
            "Kuidas järjestame otsingutulemusi ja millised tunnused määravad järjekorra, selgitame jaotises [Teave hindade, järjestuse ja soovituste kohta](https://mybestdays.dk/rechtliches/preisangaben).",
            "Püüdleme pidevalt kättesaadava Platvormi poole, kuid ei võlgne katkematut kättesaadavust. Hooldus, häired ja kohandused on võimalikud.",
            "Pakkujate sisu tõlked võivad olla masinloodud. Määrav on pakkuja sisestatud algversioon.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Meie väärtused",
          paragraphs: [
            "Ootame külalistelt ja pakkujatelt lugupidavat suhtumist. Diskrimineerimine päritolu, nahavärvi, usutunnistuse, veendumuste, soo, sooidentiteedi, seksuaalse sättumuse, puude, vanuse või sarnaste tunnuste tõttu ei ole Platvormil lubatud – vt [Diskrimineerimisvastane poliitika](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Viibimise ajal kehtivad käitumisele [Külaliste põhireeglid](https://mybestdays.dk/rechtliches/grundregeln-gaeste), pakkujatele [Pakkujate käitumisjuhend](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Teie konto ja Platvormi kasutamine",
          paragraphs: [
            "Broneeringu jaoks võite luua konto. Vastutate oma juurdepääsuandmete konfidentsiaalsuse eest ja teatate meile viivitamata, kui kahtlustate volitamata kasutamist.",
            "Platvormi tohite kasutada üksnes juhul, kui olete teovõimeline ja saate kehtivalt lepinguid sõlmida.",
            "Teie andmed registreerimisel ja broneerimisel peavad olema õiged ja täielikud – eelkõige nimi, kontaktandmed ja reisijate arv. Pakkuja vajab neid andmeid majutuskoha pakkumiseks ja oma registreerimiskohustuste täitmiseks.",
            "Eelkõige ei ole lubatud:",
          ],
          list: [
            "näilikud broneeringud, pettuslikud maksed või võõraste maksevahendite kasutamine ilma volituseta;",
            "Platvormi automatiseeritud andmete kogumine (scraping, crawler) väljaspool seda, mida lubab meie robots.txt fail;",
            "meetmed, mis häirivad või koormavad üle Platvormi või selle aluseks olevat taristut või hoiavad kõrvale nende turvameetmetest;",
            "õigusvastase, solvava või eksitava sisu lisamine arvustustesse, sõnumitesse või profiiliandmetesse;",
            "katse broneering vormistada Platvormist mööda pärast seda, kui kontakt tekkis Platvormi kaudu – vt [Tasud väljaspool platvormi](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Hinnad",
          paragraphs: [
            "Kõiki hindu kuvatakse kogumaksumusena koos maksude ja kõigi Platvormi kaudu arvestatavate tasudega niipea, kui reisiandmed (periood ja reisijate arv) on teada. Kui mõni osa kuulub tasumisele alles kohapeal, toome selle enne broneeringu lõpetamist eraldi välja.",
            "Hindu kuvatakse kuulutuse valuutas. Kui summat kuvatakse Teile lisaks mõnes muus valuutas, on see mittesiduv ümberarvestus orientiiriks; arveldatakse kuulutuse valuutas, kui maksmise käigus ei ole märgitud teisiti.",
            "Hinnad võivad kuni broneeringu lõpetamiseni muutuda, näiteks seetõttu, et pakkuja neid kohandab või saadavus muutub. Määrav on hind, mida Teile vahetult enne siduvat broneeringut kuvatakse ja mis on nimetatud broneeringu kinnituses.",
            "Ilmsed hinnavead (nt suurusjärkude võrra vale summa) ei seo ei meid ega pakkujat. Sellise vea tuvastamisel teavitame Teid viivitamata; broneeringu võite siis tasuta tühistada.",
            "Kuidas teenustasud kujunevad, on kirjas jaotises [Teave teenustasude kohta](https://mybestdays.dk/rechtliches/servicegebuehren). Maksude ja lõivude kohta vt [Maksupoliitika](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Maksmine",
          paragraphs: [
            "Makseid Platvormi kaudu töötleb makseteenuse pakkuja Stripe. Makseandmeid (nt kaardiandmeid) kogub ja töötleb otse Stripe; myBestDays ei säilita täielikke kaardiandmeid.",
            "Millal milline summa kuulub tasumisele – ettemaks, jääk või kohapealne makse – oleneb kuulutusest ja on välja toodud enne broneeringu lõpetamist. Üksikasju reguleerivad [Maksetingimused](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Kui kuulutuses on ette nähtud tagatisraha, võib see olla eelnevalt autoriseeritud või sisse nõutud ja kahju korral täielikult või osaliselt kinni peetud; määravad on kuulutuse andmed.",
            "Kui makse ebaõnnestub või tagasi pööratakse, võidakse broneering tühistada. Pakkuja võib jätkuvalt nõuda summasid, mis on tekkinud tema tühistamistingimuste kohaselt.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Poliitikad",
          paragraphs: [
            "Lisaks käesolevatele tingimustele kehtivad järgmised poliitikad, mis on Teie ja meie vahelise lepingu osa:",
          ],
          list: [
            "[Sobiva sisu reeglid](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Arvustuste poliitika](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Diskrimineerimisvastane poliitika](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Külaliste põhireeglid](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Tühistamistingimused](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Ümberbroneerimise ja tagasimakse poliitika](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Raskete häirete poliitika](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Autoriõiguse poliitika](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Andmekaitse ja küpsised",
          paragraphs: [
            "Kuidas töötleme isikuandmeid, on kirjas [Privaatsuspoliitikas](https://mybestdays.dk/rechtliches/datenschutz). Milliseid küpsiseid ja sarnaseid tehnoloogiaid kasutame, on kirjas [Küpsisepoliitikas](https://mybestdays.dk/rechtliches/cookies).",
            "Broneeringu jaoks edastame pakkujale andmed, mida ta vajab majutusteenuse osutamiseks. Pakkuja on nende osas iseseisev vastutav töötleja; talle kohalduvad [Andmekaitsestandardid võõrustajatele](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Ligipääsetavus",
          paragraphs: [
            "Platvormi ligipääsetavuse seisu ja takistustest teatamise tee kirjeldab [Ligipääsetavuse deklaratsioon](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Andmed majutuskoha ligipääsetavuse kohta pärinevad pakkujalt. Kui sõltute kindlatest omadustest, selgitage need enne broneerimist pakkujaga sõnumifunktsiooni kaudu välja.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Arvustused ja kasutajate loodud sisu",
          paragraphs: [
            "Pärast viibimist võite jätta arvustuse. Arvustuse tohib jätta üksnes see, kes on broneerinud Platvormi kaudu ja viibimist alustanud või oleks saanud alustada – nii tagame, et avaldatud arvustused pärinevad tegelikelt külalistelt.",
            "Me ei maksa arvustuste eest, ei muuda nende sisu ega suru arvustust maha üksnes seetõttu, et see on negatiivne. Üksikasjad ja põhjused, mille tõttu arvustuse eemaldame, on kirjas [Arvustuste poliitikas](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Sisu eest, mille lisate – arvustused, fotod, sõnumid, profiiliandmed – jääte vastutavaks Teie. Annate meile lihtlitsentsi, mis on ruumiliselt ja ajaliselt piiramatu ja tasuta, seda sisu Platvormi käitamise ja reklaamimise raames reprodutseerida, töödelda (nt kärpida, tõlkida) ja üldsusele kättesaadavaks teha. Oma sisu võite kustutada; juba tehtud kasutused juba avaldatud kogumikes sellest ei muutu.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Sõnumid ja suhtlus pakkujaga",
          paragraphs: [
            "Sõnumid Teie ja pakkuja vahel liiguvad Platvormi kaudu. Meie pakume sõnumifunktsiooni, kuid ei ole sisu saatja ega saaja.",
            "Meil on õigus sõnumeid automatiseeritult kontrollida käesolevate tingimuste rikkumiste suhtes (nt kontaktandmed Platvormist möödahiilimiseks, pettusemustrid, õigusvastane sisu) ning asjaomaseid sõnumeid kinni pidada või eemaldada. Eemaldamisest teavitame Teid põhjendusega punkti A17 kohaselt.",
            "Saadame Teile sõnumeid Teie broneeringu kohta (kinnitus, muudatused, saabumisteave) märgitud e-posti aadressile. Need sõnumid on lepinguline suhtlus ja neist ei saa loobuda, kuni broneering kehtib. Reklaamsõnumeid saate üksnes niivõrd, kuivõrd olete andnud nõusoleku või õigus lubab seda ilma nõusolekuta; võite igal ajal vastu vaielda.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Intellektuaalomandi õigused",
          paragraphs: [
            "Platvorm, selle kujundus, tarkvara, andmebaasid, tekstid ja kaubamärgid on kaitstud. Saate lihtlitsentsi, mis ei ole üleantav, kasutada Platvormi majutuskohtade otsimiseks ja broneerimiseks – rohkemat mitte.",
            "Meie kaubamärkide ja logode kasutamist reguleerivad [Kaubamärgireeglid](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Kui leiate, et Platvormi sisu rikub Teie autoriõigust, järgige [Autoriõiguse poliitikat](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Mida teha, kui midagi läheb valesti",
          paragraphs: [
            "Kui probleem puudutab majutuskohta ennast, pöörduge esmalt pakkuja poole – sõnumifunktsiooni kaudu või kohapeal. Paljud probleemid lahenevad nii kõige kiiremini.",
            "Kui pakkujaga edasi ei jõua või probleem puudutab Platvormi, makset või broneeringu vormistamist, pöörduge meie poole. Kuidas meieni jõuda ja kuidas kaebusi menetleme, on kirjas jaotises [Kaebused ja vaidluste lahendamine](https://mybestdays.dk/rechtliches/beschwerden).",
            "Hoidke käepärast: broneeringu number, broneeringu e-posti aadress, lühike probleemi kirjeldus koos sooviga, kuidas peaksime aitama, ja asjakohased tõendid (fotod, sõnumid, kviitungid).",
            "Kui majutuskoht ei ole saabumisel saadaval või erineb oluliselt kuulutusest, kohaldub [Ümberbroneerimise ja tagasimakse poliitika](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Euroopa Komisjoni veebipõhine vaidluste lahendamise platvorm tunnistati kehtetuks määrusega (EL) 2024/3228 ja lõpetas tegevuse; teena see enam ei ole kättesaadav. Millised asutused selle asendavad, on kirjas jaotises [Kaebused ja vaidluste lahendamine](https://mybestdays.dk/rechtliches/beschwerden).",
            "Kui oleme võtnud meetme Teie sisu või konto vastu, võite lisaks meie sisemisele kaebemenetlusele pöörduda ka määruse (EL) 2022/2065 artikli 21 kohaselt sertifitseeritud kohtuvälise vaidluste lahendamise organi poole. Selle otsused ei ole meile siduvad.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Meetmed sobimatu käitumise vastu",
          paragraphs: [
            "Kui rikute käesolevaid tingimusi või mõnda punktis A9 nimetatud poliitikat, võime – astmeliselt vastavalt rikkumise raskusele, sagedusele ja mõjule – eemaldada sisu või piirata selle nähtavust, blokeerida funktsioone, tühistada broneeringuid või Teie konto ajutiselt või alaliselt blokeerida.",
            "Enne meedet hindame üksikjuhtumit. Ilmselgelt õigusvastase sisu, inimeste ohustamise või pettuse korral võime tegutseda kohe.",
            "Iga meetme põhjendame Teile ja juhime tähelepanu kaebeteele – vt A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Õigusvastasest sisust teatamine ja meetmete põhjendamine",
          paragraphs: [
            "Igaüks võib meile teatada sisust, mida ta peab õigusvastaseks. Teatamismenetlus määruse (EL) 2022/2065 artikli 16 kohaselt, meie kontaktpunktid ja teadetega tegelemine on kirjeldatud jaotises [Digiteenuste õigusakt](https://mybestdays.dk/rechtliches/dsa).",
            "Kui võtame meetme Teie lisatud sisu või Teie konto vastu, saate põhjenduse, milles on märgitud põhjus, faktiline alus, õiguslik alus või rikutud lepingutingimus ning kaebevõimalused.",
            "Iga meetme peale võite kuue kuu jooksul esitada tasuta kaebuse. Kaebusi menetlevad inimesed, mitte üksnes automatiseeritud vahendid.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Vastutuse piiramine",
          paragraphs: [
            "Vastutame piiramatult tahtluse ja raske hooletuse eest, elu, keha või tervise kahjustamisest tuleneva kahju eest ning meie võetud garantii ulatuses. Tootevastutusõigusest tulenevad nõuded jäävad puutumata.",
            "Muus osas on meie vastutus piiratud ettenähtava kahjuga, mis tüüpiliselt tuleneb selliste kohustuste rikkumisest, mille täitmisele võite tugineda – ja üksnes niivõrd, kuivõrd kohaldatav õigus sellist piirangut lubab.",
            "Me ei vastuta majutusteenuse enda osutamise eest ega pakkujate või teiste külaliste käitumise eest. Majutusteenuse lepingupartner on pakkuja.",
            "Me ei vastuta pakkujate sisestatud andmete õigsuse eest, kui me neid ei teadnud ega pidanudki teadma. Saades teada õigusvastasest andmest, tegutseme viivitamata.",
            "Kaugemale ulatuv vastutus on välistatud. Imperatiivsed seadusjärgsed nõuded, eelkõige tarbijaõigused, jäävad puutumata.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Kohaldatav õigus ja kohtualluvus",
          paragraphs: [
            "Kohaldatakse Taani õigust – käitaja asukoht on Taanis – välistades ÜRO kaupade rahvusvahelise müügi lepingute konventsiooni. Selle riigi imperatiivsed tarbijakaitsesätted, kus on Teie harilik viibimiskoht, jäävad määruse (EÜ) nr 593/2008 (Rooma I) artikli 6 kohaselt puutumata.",
            "Tarbijana võite meid kaevata oma elukoha kohtusse või meie asukohta Taanis; meie saame Teid kaevata üksnes Teie elukoha kohtusse (määruse (EL) nr 1215/2012 artiklid 17–19).",
            "Majutuslepingule kohaldatakse üldjuhul selle riigi õigust, kus majutuskoht asub; kinnisasja üürist tulenevate hagide osas on ainupädevad selle riigi kohtud.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Seotud reisikorraldusteenused",
          paragraphs: [
            "myBestDays vahendab üksnes majutusteenuseid. Me ei paku lende, rendiautosid, veoteenuseid, ekskursioone ega vaatamisväärsusi ega koosta pakettreise direktiivi (EL) 2015/2302 tähenduses.",
            "Kui edaspidi vahendaksime ka muid reisiteenuseid, teavitame Teid enne broneerimist seaduses ette nähtud tüüpvormiga sellest, kas tekib pakettreis või seotud reisikorraldusteenus ja millised õigused Teile sellest tulenevad.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Kestus, blokeerimine ja ülesütlemine",
          paragraphs: [
            "Platvormi kasutamise leping on sõlmitud tähtajatult. Oma konto võite igal ajal põhjust nimetamata kustutada; olemasolevaid broneeringuid see ei mõjuta ja need täidetakse vastava pakkuja tingimuste kohaselt.",
            "Kasutuslepingu võime üles öelda 14-päevase etteteatamisega. Käesolevate tingimuste raske rikkumise korral võime öelda üles etteteatamiseta ja konto blokeerida.",
            "Pärast lõppemist kustutame Teie andmed, kui sellega ei ole vastuolus seadusjärgne säilitamiskohustus või õigustatud huvi säilitamiseks; üksikasju reguleerib [Privaatsuspoliitika](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Muutmisklausel",
          paragraphs: [
            "Käesolevaid tingimusi võime muuta, kui selleks on objektiivne põhjus – näiteks muutunud õiguslik olukord, kõrgeimate kohtute praktika, Platvormi uued või kaotatud funktsioonid või regulatsioonilünkade kõrvaldamine.",
            "Muudatustest teatame kirjalikku taasesitamist võimaldavas vormis vähemalt 30 päeva enne jõustumist. Kui Te jõustumiseni vastu ei vaidle, loetakse muudetud tingimused vastuvõetuks; sellele tagajärjele juhime teates eraldi tähelepanu. Kui vaidlete vastu, võime kasutuslepingu jõustumise kuupäeval üles öelda.",
            "Juba sõlmitud broneeringutele kohaldatakse tingimusi redaktsioonis, mis kehtis broneerimise ajal.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Majutuskohad",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Käesoleva punkti ulatus",
          paragraphs: [
            "Käesolev punkt kehtib majutuskohtade broneerimisele Platvormi kaudu – nii puhkeobjektide kui ka majutusettevõtete tubade ja ühikute puhul.",
            "See täiendab punkti A. Vastuolude korral on ülimuslik käesolev punkt B.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Lepinguline suhe",
          paragraphs: [
            "Majutusleping sõlmitakse üksnes Teie ja pakkuja vahel. myBestDays ei ole lepingupool.",
            "Majutuskoha esitlemine Platvormil on üleskutse Teile teha broneerimispakkumine. Klõpsates maksekohustusega broneerimisnupul, teete siduva pakkumise.",
            "Leping loetakse sõlmituks, kui broneering kinnitatakse. Broneeringu kinnituse saadame Teie märgitud e-posti aadressile; selles on nimetatud pakkuja, broneeritud teenus, periood, kogumaksumus ja tühistamistingimused.",
            "Päringupõhise broneeringuga majutuskohtade puhul sõlmitakse leping alles pakkuja nõustumusega. Seni võib Teie maksevahend olla eelnevalt autoriseeritud, kuid mitte debiteeritud.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Mida teeme meie",
          paragraphs: [
            "Pakume Platvormi, kuvame pakkujate kuulutusi, võtame vastu Teie broneeringu, edastame selle pakkujale ja saadame Teile broneeringu kinnituse.",
            "Töötleme makset, kui kuulutus näeb ette maksmise Platvormi kaudu, ja pakume sõnumifunktsiooni Teie ja pakkuja vahel.",
            "Me ei paku majutuskohta, ei käita seda ega taga selle seisukorda. Me ei ole Teie reisikorraldaja.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Mida peate tegema Teie",
          paragraphs: [
            "Vaadake kuulutus enne broneerimist täielikult läbi: sisustus, täituvuse piirang, saabumis- ja lahkumisajad, majareeglid, tühistamistingimused ja kulud, mis tekivad alles kohapeal.",
            "Järgige kuulutuses näidatud maksimaalset täituvust. Kui saabub rohkem inimesi kui broneeritud, võib pakkuja vastuvõtmisest keelduda või nõuda lisatasu.",
            "Järgige pakkuja majareegleid ja [Külaliste põhireegleid](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Käitute majutuskohaga hoolikalt ja vastutate kahju eest, mille põhjustate Teie või Teie kaasreisijad.",
            "Kui pakkuja või ametiasutus vajab registreerimiseks andmeid (nt registreerimisleht, isikut tõendava dokumendi andmed, kuurordimaksu deklaratsioon), esitate need õigeaegselt.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Hinnad ja maksmine",
          paragraphs: [
            "Kogumaksumus hõlmab ööbimishinda broneeritud perioodi eest ning kuulutuses näidatud lisatasusid ja tasusid, mis arvestatakse Platvormi kaudu.",
            "Kohapeal võivad tekkida täiendavad summad – eelkõige kuurordimaks või kohalikud lõivud, tagatisraha ning lisateenused, mille tellite alles kohapeal. Need toome enne broneeringu lõpetamist välja kohapealsete kuludena, kui pakkuja on need esitanud.",
            "Kui kuulutus näeb ette ettemaksu, kuulub jääk tasumisele kuulutuses nimetatud ajal. Kui jääk jääb laekumata, võib pakkuja oma tühistamistingimuste kohaselt lepingust taganeda.",
            "Makseid pakkujale väljaspool Platvormi me vastu ei võta ega saa neid jälgida; need ei kuulu meie maksete töötlemise alla – vt [Tasud väljaspool platvormi](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Muudatused, tühistamised ja tagasimaksed",
          paragraphs: [
            "Kas ja millistel tingimustel saab broneeringut tasuta tühistada või muuta, sõltub kuulutuses näidatud pakkuja tühistamistingimustest. Tingimusi, mida pakkujatele valikuks pakume, kirjeldavad [Tühistamistingimused](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "Kindlaks perioodiks broneeritud majutusteenuste puhul ei ole reeglina seadusjärgset taganemisõigust direktiivi 2011/83/EL artikli 16 punkti l ega vastavate siseriiklike sätete kohaselt. Imperatiivsed seadusjärgsed õigused jäävad puutumata.",
            "Kui tühistab pakkuja, tagastame Platvormi kaudu makstud summa täielikult. Lisaks kohaldub [Ümberbroneerimise ja tagasimakse poliitika](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Kui mõlema poole kontrolli alt väljas olev sündmus takistab reisi või viibimist, kehtib [Raskete häirete poliitika](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Tagasimaksed tehakse maksmiseks kasutatud maksevahendile, kui ei ole kokku lepitud teisiti.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Mida peate lisaks teadma",
          paragraphs: [
            "Pakkujad võivad olla eravõõrustajad või ettevõtjad. Kas pakkuja tegutseb ettevõtjana, toome kuulutuses välja. Kui tegemist ei ole ettevõtjaga, ei kohaldata majutuslepingule liidu tarbijakaitsesätteid – sellele asjaolule juhime Teie tähelepanu kuulutuses.",
            "Andmed asukoha, ümbruse, vahemaade ja kolmandate isikute hinnangute kohta on orientiiriks. Siduvad on andmed broneeritud teenuse enda kohta.",
            "Lühiajalise üürile andmise registreerimiskohustusega piirkondades toome kuulutuses välja pakkuja esitatud registreerimisnumbri; vt [Lühiajaline üürile andmine](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Mitme identse objekti- või toatüübi ühiku puhul broneerite ühe selle tüübi ühiku. Millise konkreetse ühiku saate, määrab pakkuja.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Sõnastik",
      paragraphs: [
        "Järgmistel mõistetel on käesolevates tingimustes siin nimetatud tähendus.",
      ],
      definitions: [
        {
          term: "Pakkuja",
          description:
            "Füüsiline või juriidiline isik, kes pakub majutuskohta Platvormi kaudu ja saab majutuslepingu pooleks.",
        },
        {
          term: "Päringupõhine broneering",
          description:
            "Broneering, mis sõlmitakse alles pärast pakkuja sõnaselget nõustumust, erinevalt kohesest broneeringust.",
        },
        {
          term: "Broneeringu kinnitus",
          description:
            "Sõnum, millega kinnitame Teile majutuslepingu sõlmimist; see sisaldab pakkujat, teenust, perioodi, kogumaksumust ja tühistamistingimusi.",
        },
        {
          term: "Ühik",
          description:
            "Konkreetne broneeritav objekt objekti- või toatüübi all. Müüakse ühik, kirjeldatakse ja hinnastatakse tüüp.",
        },
        {
          term: "Kogumaksumus",
          description:
            "Broneeringu lõpetamisel näidatud summa, sealhulgas kõik maksud ja kõik Platvormi kaudu arvestatavad tasud.",
        },
        {
          term: "Maksimaalne täituvus",
          description:
            "Kuulutuses näidatud suurim lubatud isikute arv, kes tohivad majutuskohas ööbida.",
        },
        {
          term: "Tagatisraha",
          description:
            "Summa, mida pakkuja nõuab tagatiseks kahjude vastu ja mis eelnevalt autoriseeritakse või sisse nõutakse ning pärast viibimist vabastatakse või tasaarvestatakse.",
        },
        {
          term: "Kuurordimaks",
          description:
            "Kohalik lõiv ööbimiste eest, mida olenevalt omavalitsusest kogutakse kohapeal või pakkuja kaudu; see ei ole myBestDays teenus.",
        },
        {
          term: "Platvorm",
          description:
            "Veebisait, mobiilirakendused ja kõik muud juurdepääsuvõimalused, mille kaudu myBestDays kuvab majutuskohti ja vahendab broneeringuid.",
        },
        {
          term: "Teenustasu",
          description:
            "Tasu myBestDays vahendusteenuse eest. Kes seda kannab ja kuidas seda näidatakse, on kirjas teenustasusid puudutavas teabes.",
        },
        {
          term: "Tühistamistingimused",
          description:
            "Pakkuja valitud reeglid selle kohta, mis ajani ja milliste kuludega saab broneeringut tühistada või muuta.",
        },
        {
          term: "Majutuskoht",
          description:
            "Pakkuja pakutav majutusteenus – puhkeobjekt või toa- või objektitüübi ühik.",
        },
        {
          term: "Kohapealsed kulud",
          description:
            "Summad, mida ei arvestata Platvormi kaudu, vaid mis kuuluvad tasumisele pakkujale, näiteks kuurordimaks, tagatisraha või kohapeal tellitud lisateenused.",
        },
      ],
    },
  ],
};
