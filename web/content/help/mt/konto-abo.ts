import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Kont u Abbonament",
  description: "Dejta bażika, tariffa, sigurtà u 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Kont",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Dejta Bażika tan-Negozju",
          excerpt: "Immaniġġja ċentralment l-isem tal-kumpanija, l-indirizz u d-dettalji ta' kuntatt tan-negozju tiegħek.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Taħt /konto, myNextDays tiġbor il-funzjonijiet kollha tan-negozju u tal-kont bħala taqsimiet f'paġna waħda — m'għandekx bżonn taqleb bejn ħafna sub-paġni. Id-dejta bażika tan-negozju tifforma l-bażi: l-isem tal-kumpanija, il-forma legali, l-indirizz u d-dettalji ta' kuntatt użati għall-fatturi, il-portali u l-komunikazzjoni mal-mistiedna.",
            },
            { type: "h2", text: "Iftaħ u editja d-dejta bażika" },
            {
              type: "steps",
              items: [
                "Iftaħ /konto.",
                "Aqleb għat-taqsima “Dejta Bażika tan-Negozju”.",
                "Iċċekkja l-isem tal-kumpanija, l-indirizz, in-numru tat-telefown u l-indirizz tal-email għal mistoqsijiet.",
                "Wettaq il-bidliet tiegħek.",
                "Issejvja t-taqsima.",
              ],
            },
            { type: "h2", text: "Għaliex din id-dejta hija importanti" },
            {
              type: "p",
              text: "Id-dejta bażika tan-negozju tintuża fil-fatturi, fir-reġistrazzjoni mal-portali konnessi u f'dettalji obbligatorji legalment bħall-avviż legali. Indirizz mhux komplut jew skadut jista' jwassal għal fatturi maħruġa b'mod żbaljat jew konnessjonijiet ma' portali dewwmin.",
            },
            {
              type: "ul",
              items: [
                "L-isem tal-kumpanija u l-forma legali jidhru fuq il-fatturi maħruġa kollha.",
                "L-indirizz huwa meħtieġ għar-reġistrazzjoni mal-portali.",
                "Id-dettalji ta' kuntatt jservu bħala mezz alternattiv f'każ li n-notifiki tas-sistema ma jaslux.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jekk tibdel l-indirizz tal-fatturazzjoni tiegħek, iċċekkja wara l-fatturi diġà maħruġa taħt [Fatturazzjoni u Kalkulatur tat-Tariffa](/hilfe/konto-abo/abrechnung-tarifrechner) — id-dokumenti eżistenti ma jiġux aġġustati b'mod retroattiv.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Abbonament u Tariffa",
          excerpt: "It-tariffa tiegħek tiddetermina l-kwota tal-proprjetajiet — in-numru ta' proprjetajiet prenotati tarah fi kwalunkwe ħin fil-Kont.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "L-abbonament tiegħek ta' myNextDays jinkludi kwota ta' proprjetajiet: in-numru massimu ta' proprjetajiet (kmamar jew proprjetajiet tal-vaganzi) li tista' timmaniġġja attivament fl-istess ħin. In-numru attwali ta' proprjetajiet prenotati jintwera fit-taqsima “Abbonament u Tariffa” taħt /konto, flimkien mal-kwota li fadal.",
            },
            { type: "h2", text: "Żomm il-kwota f'moħħok" },
            {
              type: "p",
              text: "Il-kwota tiġi infurzata fuq in-naħa tas-server: jekk tilħaq il-limitu massimu tat-tariffa tiegħek, ma tistax toħloq aktar proprjetajiet sakemm tiddiżattiva proprjetà eżistenti jew tespandi t-tariffa tiegħek. Dan japplika indipendentement minn jekk il-proprjetà l-ġdida hijiex kamra jew proprjetà tal-vaganzi — it-tnejn jgħoddu ndaqs għall-kwota.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ /konto u t-taqsima “Abbonament u Tariffa”.",
                "Iċċekkja n-numru ta' proprjetajiet prenotati fir-rigward tal-kwota tat-tariffa tiegħek.",
                "Agħżel tariffa akbar jekk meħtieġ biex toħloq aktar proprjetajiet.",
                "Ikkonferma l-bidla tat-tariffa.",
              ],
            },
            {
              type: "ul",
              items: [
                "Kull proprjetà tgħodd individwalment għall-kwota, indipendentement mit-tip ta' proprjetà.",
                "Bidla fit-tariffa taffettwa minnufih il-kwota disponibbli.",
                "Downgrade huwa possibbli biss jekk in-numru ta' proprjetajiet attivi jaqbel mal-kwota l-ġdida.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Downgrade lejn tariffa b'kwota iżgħar jiġi rrifjutat sakemm ikun hemm aktar proprjetajiet attivi milli tippermetti t-tariffa l-ġdida. Iddiżattiva l-ewwel il-proprjetajiet żejda.",
            },
            {
              type: "note",
              variant: "info",
              text: "Dettalji dwar il-fatturi u l-kalkolu tat-tariffa ssibhom taħt [Fatturazzjoni u Kalkulatur tat-Tariffa](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Fatturazzjoni u Kalkulatur tat-Tariffa",
          excerpt: "L-indirizz tal-fatturazzjoni, il-fatturi preċedenti u l-kalkulatur tat-tariffa għall-kwota tal-proprjetajiet tiegħek.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "It-taqsima “Fatturazzjoni u Kalkulatur tat-Tariffa” taħt /konto tiġbor kollox dwar il-ħruġ tal-fatturi: l-indirizz tal-fatturazzjoni tiegħek, il-lista tal-fatturi preċedenti li tista' tniżżel, kif ukoll kalkulatur tat-tariffa li permezz tiegħu tista' tara l-ispejjeż għall-kwota kurrenti jew akbar tal-proprjetajiet.",
            },
            { type: "h2", text: "Indirizz tal-Fatturazzjoni u Fatturi" },
            {
              type: "p",
              text: "L-indirizz tal-fatturazzjoni jista' jkun differenti mill-indirizz tan-negozju tiegħek, pereżempju jekk uffiċċju tat-taxxa jirċievi d-dokumenti. Il-fatturi diġà maħruġa ssibhom issortjati kronoloġikament; kull waħda tista' titniżżel bħala PDF.",
            },
            { type: "h2", text: "Uża l-kalkulatur tat-tariffa" },
            {
              type: "steps",
              items: [
                "Iftaħ /konto u t-taqsima “Fatturazzjoni u Kalkulatur tat-Tariffa”.",
                "Daħħal fil-kalkulatur tat-tariffa n-numru ta' proprjetajiet mixtieq.",
                "Qabbel l-ispejjeż li jirriżultaw għal kull livell ta' tariffa.",
                "Aqleb direttament mill-kalkulatur għat-tariffa xierqa jekk meħtieġ.",
              ],
            },
            {
              type: "ul",
              items: [
                "Il-kalkulatur tat-tariffa juri l-ispejjeż fil-munita reġistrata għall-kont tiegħek.",
                "Il-fatturi jibqgħu disponibbli għat-tniżżil b'mod permanenti.",
                "L-indirizz tal-fatturazzjoni jista' jiġi mmaniġġjat indipendentement mid-dejta bażika tan-negozju.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Qabbel regolarment bil-kalkulatur tat-tariffa jekk il-kwota tal-proprjetajiet tiegħek għadhiex taqbel man-numru attwali ta' proprjetajiet prenotati — ara [Abbonament u Tariffa](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Ibdel il-Password u l-Email",
          excerpt: "Bidliet kritiċi għas-sigurtà jitolbu awtentikazzjoni mill-ġdid u pass ta' konferma.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Il-password u l-indirizz tal-email huma fost id-dettalji l-aktar kritiċi għas-sigurtà tal-kont tiegħek. Għalhekk myNextDays titlob awtentikazzjoni mill-ġdid għaż-żewġ bidliet — tikkonferma l-bidla bil-password kurrenti tiegħek, anke jekk diġà tkun daħlet.",
            },
            { type: "h2", text: "Ibdel il-password" },
            {
              type: "steps",
              items: [
                "Iftaħ /konto u t-taqsima “Ibdel il-Password u l-Email”.",
                "Daħħal il-password kurrenti tiegħek għall-konferma.",
                "Agħti l-password il-ġdid u irrepetih.",
                "Issejvja l-bidla.",
              ],
            },
            { type: "h2", text: "Ibdel l-indirizz tal-email" },
            {
              type: "p",
              text: "Il-bidla tal-indirizz tal-email issir b'doppju opt-in: wara l-konferma tal-password kurrenti tiegħek, tirċievi link ta' konferma fl-indirizz IL-ĠDID. Il-bidla ssir effettiva biss meta tikklikkja fuq dan il-link — l-indirizz il-qadim jibqa' attiv sa dak il-ħin, sabiex l-aċċess għall-kont tiegħek qatt ma jkun interrott.",
            },
            {
              type: "ul",
              items: [
                "Mingħajr il-password kurrenti, la l-password u lanqas l-email ma jistgħu jinbidlu.",
                "Il-link ta' konferma għall-indirizz tal-email il-ġdid huwa validu għal żmien limitat.",
                "Sal-konferma, l-indirizz tal-email preċedenti jibqa' attiv għad-dħul u n-notifiki.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Wara bidla fl-email, iċċekkja wkoll l-awtentikazzjoni b'żewġ fatturi — ara [Awtentikazzjoni b'Żewġ Fatturi](/hilfe/konto-abo/zwei-faktor) — jekk il-kodiċi ta' rkupru kienu marbuta mal-indirizz il-qadim.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Awtentikazzjoni b'Żewġ Fatturi",
          excerpt: "Pass addizzjonali ta' dħul jipproteġi l-kont tiegħek minn aċċess mhux awtorizzat.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "L-awtentikazzjoni b'żewġ fatturi (2FA) iżżid mal-password tiegħek fattur ieħor permezz ta' app ta' awtentikazzjoni. B'hekk password misruq waħdu ma jkunx biżżejjed biex tidħol fil-kont tiegħek ta' myNextDays.",
            },
            { type: "h2", text: "Ikkonfigura l-2FA" },
            {
              type: "steps",
              items: [
                "Iftaħ /konto u t-taqsima “Awtentikazzjoni b'Żewġ Fatturi”.",
                "Ikkonferma l-password kurrenti tiegħek għall-awtentikazzjoni mill-ġdid.",
                "Skennja l-kodiċi QR muri b'app ta' awtentikazzjoni.",
                "Daħħal il-kodiċi ġġenerat għall-konferma.",
                "Issejvja l-kodiċijiet ta' rkupru murija f'post sikur.",
              ],
            },
            { type: "h2", text: "Iddiżattiva l-2FA" },
            {
              type: "p",
              text: "Anke d-diżattivazzjoni tal-awtentikazzjoni b'żewġ fatturi titlob awtentikazzjoni mill-ġdid bil-password kurrenti tiegħek. B'hekk myNextDays tipprevjeni li xi ħadd b'sessjoni diġà miftuħa sempliċement jitfi l-protezzjoni tiegħek.",
            },
            {
              type: "ul",
              items: [
                "Il-kodiċijiet ta' rkupru jippermettu l-aċċess jekk l-app ta' awtentikazzjoni tintilef.",
                "Kull kodiċi ta' rkupru jista' jintuża darba biss.",
                "L-attivazzjoni u d-diżattivazzjoni tal-2FA huma t-tnejn marbuta ma' konferma tal-password.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Żomm il-kodiċijiet ta' rkupru tiegħek separati mid-apparat bl-app ta' awtentikazzjoni, pereżempju f'maniġer tal-passwords.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Storja tal-Apparati",
          excerpt: "Żomm f'moħħok minn liema apparati l-kont tiegħek huwa mdaħħal.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "L-istorja tal-apparati taħt /konto turik f'liema apparati l-kont tiegħek huwa mdaħħal bħalissa — bit-tip ta' apparat, il-lokazzjoni approssimattiva u l-ħin tal-aħħar attività. B'hekk tirrikonoxxi malajr jekk dħul verament oriġinax mingħandek.",
            },
            { type: "h2", text: "Iċċekkja l-istorja tal-apparati" },
            {
              type: "steps",
              items: [
                "Iftaħ /konto u t-taqsima “Storja tal-Apparati”.",
                "Rrevedi l-lista tal-apparati mdaħħla.",
                "Jekk tirrikonoxxi apparat mhux magħruf, oħroġ minnu.",
                "Wara dan, ibdel il-password tiegħek b'kawtela.",
              ],
            },
            { type: "h2", text: "Meta jagħmel sens tħares" },
            {
              type: "p",
              text: "Iċċekkja l-istorja tal-apparati speċjalment wara bidla fil-password jew fl-email kif ukoll wara l-użu ta' apparat ta' ħaddieħor jew pubbliku. Entrata mhux magħrufa hija sinjal ta' twissija ċar ta' aċċess mhux awtorizzat.",
            },
            {
              type: "ul",
              items: [
                "Kull entrata turi t-tip ta' apparat, il-lokazzjoni approssimattiva u l-aħħar attività.",
                "Apparati individwali jistgħu jinħarġu b'mod immirat, mingħajr ma jiġu affettwati l-oħrajn.",
                "Apparat mhux rikonoxxut huwa raġuni għal bidla immedjata tal-password.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Jekk ma tirrikonoxxix apparat, oħroġ minnu minnufih u wara ibdel il-password tiegħek taħt [Ibdel il-Password u l-Email](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Privatezza",
          excerpt: "Ikkontrolla l-indiċjar mill-magni tat-tfittxija għal kull proprjetà u esporta d-dejta tiegħek.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Fit-taqsima “Privatezza” taħt /konto tikkontrolla żewġ affarijiet: jekk il-paġni tal-proprjetajiet tiegħek jistgħux jiġu indiċjati mill-magni tat-tfittxija, u kif tista' tesporta d-dejta tiegħek maħżuna f'myNextDays.",
            },
            { type: "h2", text: "Indiċjar mill-Magni tat-Tfittxija għal Kull Proprjetà" },
            {
              type: "p",
              text: "Default, l-indiċjar mill-magni tat-tfittxija huwa diżattivat għal proprjetajiet ġodda. Biss meta tattivah konxjament għal kull proprjetà, magni tat-tfittxija bħal Google jistgħu jinkludu l-paġna pubblika tal-proprjetà fl-indiċi tagħhom. B'hekk iżżomm kontroll fuq liema proprjetajiet jistgħu jinstabu barra mill-portali u l-pjattaforma proprja.",
            },
            {
              type: "steps",
              items: [
                "Iftaħ /konto u t-taqsima “Privatezza”.",
                "Agħżel il-proprjetà mixtieqa mil-lista.",
                "Attiva jew diżattiva l-indiċjar mill-magni tat-tfittxija.",
                "Uża s-swiċċ kollettiv jekk ikollok diversi proprjetajiet biex tissettja lkoll b'mod uniformi.",
              ],
            },
            { type: "h2", text: "Esporta d-dejta" },
            {
              type: "p",
              text: "Permezz tal-funzjoni tal-esportazzjoni tad-dejta, titlob kopja sħiħa tad-dejta tiegħek maħżuna fil-Kont. L-esportazzjoni tiġi mħejjija u mbagħad issir disponibbli għalik biex titniżżel.",
            },
            {
              type: "ul",
              items: [
                "L-indiċjar jista' jiġi kkontrollat individwalment għal kull proprjetà, b'swiċċ kollettiv għall-proprjetajiet kollha.",
                "Proprjetajiet ġodda jibdew bażikament mingħajr indiċjar mill-magni tat-tfittxija.",
                "L-esportazzjoni tad-dejta tinkludi d-dejta tal-kont u tal-proprjetajiet tiegħek f'forma strutturata.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "L-indiċjar mill-magni tat-tfittxija huwa indipendenti mill-viżibbiltà fuq il-portali u fis-suq proprju — jaffettwa esklussivament il-paġna pubblika tal-proprjetà fil-magni tat-tfittxija.",
            },
          ],
        },
      ],
    },
  ],
};
