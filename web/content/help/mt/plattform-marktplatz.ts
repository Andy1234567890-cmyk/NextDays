import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Pjattaforma (Suq)",
  description: "Biegħ fuq is-suq ta' myBestDays.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Suq",
      articles: [
        {
          slug: "der-marktplatz",
          title: "Is-Suq ta' myBestDays",
          excerpt: "Is-suq globali ta' myBestDays huwa kanal ta' prenotazzjoni proprju flimkien mal-portali u l-websajt.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Is-suq ta' myBestDays (/plattform) huwa l-kanal globali ta' prenotazzjoni ta' myBestDays stess — komparabbli ma' Booking jew Airbnb, iżda parti mill-istess pjattaforma. Hemmhekk il-mistiedna jfittxu proprjetajiet tan-negozji kollha konnessi u jipprenotaw direttament.",
            },
            { type: "h2", text: "Mhux ‘dirett’, imma kanal fl-istess livell" },
            {
              type: "p",
              text: "Is-suq ma jissostitwixxix il-prenotazzjoni diretta permezz tal-websajt proprja tiegħek. Huwa t-tielet mogħdija ta' distribuzzjoni indipendenti b'assi ta' viżibbiltà tagħha stess, bażi ta' mistiedna tagħha stess u kummissjoni tagħha stess — eżattament bħal portal, biss operat minn myBestDays stess.",
            },
            { type: "h2", text: "Kif il-proprjetajiet jaslu fis-suq" },
            {
              type: "ul",
              items: [
                "Il-proprjetà trid tkun attiva (l-istatus tal-proprjetà jippermetti l-bejgħ).",
                "Il-viżibbiltà fis-suq trid tkun attivata — separata mill-portali u l-websajt.",
                "Trid teżisti disponibbiltà fil-kalendarju għall-perjodu mixtieq.",
              ],
            },
            { type: "h2", text: "Prenotazzjonijiet mis-suq" },
            {
              type: "p",
              text: "Prenotazzjoni mis-suq timblokka minnufih il-lejliet korrispondenti fuq il-kanali l-oħra kollha — eżattament bħal prenotazzjoni minn portal jew mill-websajt. Tidher fil-kalendarju u fir-riżervazzjonijiet tiegħek bħal kull prenotazzjoni oħra, immarkata bil-kanal “Pjattaforma”.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-Sell u status mhux attiv tal-proprjetà jaffettwaw il-kanali kollha u jimblukkaw ukoll is-suq — indipendentement mis-swiċċ tal-viżibbiltà tas-suq.",
            },
            {
              type: "p",
              text: "Kif tattiva proprjetà għas-suq, aqra taħt [Elenka Proprjetà fis-Suq](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Elenka Proprjetà fis-Suq",
          excerpt: "Il-viżibbiltà fis-suq hija swiċċ separat, distint mill-portali u l-websajt.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Il-viżibbiltà fis-suq tikkontrollaha permezz ta' swiċċ proprju fil-proprjetà — indipendentement minn jekk l-istess proprjetà tkunx viżibbli wkoll fuq il-portali jew il-websajt tiegħek.",
            },
            { type: "h2", text: "Kif telenka proprjetà" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà taħt Proprjetajiet.",
                "Aqleb għat-tab Viżibbiltà.",
                "Attiva s-swiċċ Suq tal-Pjattaforma.",
                "Iċċekkja li l-istatus tal-proprjetà huwa attiv u li teżisti disponibbiltà fil-kalendarju.",
              ],
            },
            { type: "h2", text: "Rekwiżit: profil komplut" },
            {
              type: "p",
              text: "Is-suq juri biss proprjetajiet b'dettalji kompluti — ritratt ewlieni, deskrizzjoni, faċilitajiet u prezz bażiku jridu jkunu rreġistrati. Jekk dettalji obbligatorji jkunu nieqsa, il-proprjetà tibqa' mhux viżibbli minkejja s-swiċċ attivat.",
            },
            {
              type: "ul",
              items: [
                "Mill-inqas ritratt ewlieni wieħed u deskrizzjoni waħda",
                "Karatteristiċi tal-faċilitajiet mil-lista tal-kategoriji",
                "Okkupazzjoni u prezz bażiku fil-munita tal-proprjetà reġistrata",
                "Disponibbiltà fil-kalendarju għall-perjodu mixtieq",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Jekk tikklikkja Ippubblika, myNextDays normalment tattiva flimkien is-suq, il-portali u l-websajt — tista' terġa' tiddiżattiva s-swiċċ tas-suq individwalment fi kwalunkwe ħin wara.",
            },
            { type: "h2", text: "Neħħi l-viżibbiltà mill-ġdid" },
            {
              type: "p",
              text: "Jekk tiddiżattiva s-swiċċ Suq tal-Pjattaforma, il-proprjetà tisparixxi mit-tfittxija tas-suq. Il-prenotazzjonijiet diġà kkonfermati ma jiġux affettwati u jkomplu bħas-soltu, ara [Kummissjoni tas-Suq](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Kummissjoni tas-Suq",
          excerpt: "Għal kull prenotazzjoni mwettqa permezz tas-suq tapplika l-kummissjoni reġistrata fit-tariffa.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Bħal ma jiġri ma' kull portal ta' prenotazzjoni, tapplika kummissjoni għall-prenotazzjonijiet li jsiru permezz tas-suq ta' myBestDays. Tiġi kkalkulata għal kull prenotazzjoni u hija indipendenti minn kwalunkwe kummissjoni għall-portali.",
            },
            { type: "h2", text: "Kif tiġi kkalkulata l-kummissjoni" },
            {
              type: "p",
              text: "L-ammont jiddependi mill-kummissjoni tan-negozju tiegħek irreġistrata fit-tariffa. Issib ir-rata attwali fi kwalunkwe ħin taħt Kont fit-taqsima Fatturazzjoni — hemmhekk ma jiġi assunt ebda valur ġeneriku, imma tintwera r-rata li tapplika effettivament għat-tariffa tiegħek.",
            },
            { type: "h2", text: "Fejn tara l-kummissjoni" },
            {
              type: "steps",
              items: [
                "Iftaħ Kont fil-menu.",
                "Aqleb għat-taqsima Fatturazzjoni.",
                "Iftaħ prenotazzjoni mis-suq biex tara d-dħul u l-kummissjoni fid-dettall.",
                "Iċċekkja l-ħarsa ġenerali tal-kummissjonijiet għall-perjodu ta' fatturazzjoni kurrenti.",
              ],
            },
            { type: "h2", text: "Distinzjoni mill-kummissjonijiet tal-portali" },
            {
              type: "ul",
              items: [
                "Il-kummissjoni tas-suq tapplika esklussivament għal prenotazzjonijiet permezz tas-suq ta' myBestDays.",
                "Il-prenotazzjonijiet minn portali (Booking, Airbnb u oħrajn) huma suġġetti għall-kundizzjonijiet tal-portal rispettiv.",
                "Il-prenotazzjonijiet mill-websajt huma suġġetti għall-kundizzjonijiet irreġistrati għat-tariffa tiegħek mingħajr kummissjoni tas-suq.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Il-kummissjoni tiġi determinata awtomatikament mit-tariffa tiegħek. Tariffa nieqsa jew mhux ċara twassal għal messaġġ ta' żball ċar minflok valur stmat.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Profil tal-Mistieden u Reviżjonijiet",
          excerpt: "Il-mistiedna tas-suq għandhom profil bl-istorja tal-prenotazzjonijiet u jistgħu jħallu reviżjonijiet.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Il-mistiedna li jipprenotaw permezz tas-suq ta' myBestDays joħolqu profil ta' mistieden tagħhom stess. Fih jinġabru l-prenotazzjonijiet tagħhom, il-messaġġi man-negozji u r-reviżjonijiet mogħtija — b'mod simili għal kont ta' mistieden f'portal.",
            },
            { type: "h2", text: "X'tara bħala negozju" },
            {
              type: "p",
              text: "Fid-dettalji tar-riżervazzjoni ta' prenotazzjoni mis-suq issib il-profil tal-mistieden bis-soġġorni preċedenti man-negozju tiegħek u, jekk rilaxxat mill-mistieden, ir-reviżjonijiet viżibbli pubblikament dwar akkomodazzjonijiet oħra.",
            },
            { type: "h2", text: "Reviżjonijiet wara s-soġġorn" },
            {
              type: "steps",
              items: [
                "Wara l-check-out, il-mistieden jirċievi stedina biex jagħti reviżjoni.",
                "Ir-reviżjoni tidher fuq il-paġna tal-proprjetà fis-suq wara verifika qasira.",
                "Bħala negozju, tista' twieġeb pubblikament għal kull reviżjoni.",
                "Reviżjonijiet inġusti jew abbużivi tista' tirrapportahom għal verifika permezz ta' Irrapporta.",
              ],
            },
            {
              type: "ul",
              items: [
                "Ir-reviżjonijiet huma marbuta ma' prenotazzjoni reali — l-ebda reviżjoni mingħajr soġġorn.",
                "Il-mistieden jevalwa n-nadafa, il-komunikazzjoni, il-post u l-valur għall-flus.",
                "It-tweġiba tiegħek hija viżibbli għaż-żjajjar kollha tas-suq.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reviżjonijiet tajbin jaffettwaw direttament il-pożizzjonament tal-proprjetà tiegħek fit-tfittxija tas-suq — irreaġixxi malajr u b'mod oġġettiv għall-kritika.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Persuni Mblukkati",
          excerpt: "Negozju jista' jimblokka mistieden, sabiex il-messaġġi u l-prenotazzjonijiet jiġu impediti.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Jekk ikun hemm problemi ma' mistieden, tista' timblukkah bħala negozju. Persuna mblukkata ma tistax tibgħatlek aktar messaġġi u ma tistax toħloq aktar prenotazzjoni ġdida man-negozju tiegħek.",
            },
            { type: "h2", text: "Imblokka persuna" },
            {
              type: "steps",
              items: [
                "Iftaħ l-istorja tal-messaġġi jew ir-riżervazzjoni mal-mistieden ikkonċernat.",
                "Ikklikkja Imblokka Mistieden.",
                "Ikkonferma d-djalogu — l-imblukkar japplika minnufih.",
                "Il-persuna mblukkata tidher wara f'Kont taħt Persuni Mblukkati.",
              ],
            },
            { type: "h2", text: "X'jikkawża l-imblukkar" },
            {
              type: "ul",
              items: [
                "Il-mistieden ma jistax jibgħat aktar messaġġi ġodda lin-negozju tiegħek.",
                "Il-mistieden ma jistax joħloq prenotazzjoni ġdida man-negozju tiegħek.",
                "Prenotazzjoni kurrenti b'wasla diġà kkonfermata fiż-żewġ ġimgħat li ġejjin ma tiġix affettwata mill-imblukkar, sabiex is-soġġorn ikun jista' jiġi ttrattat kif suppost.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "L-imblukkar japplika esklussivament għan-negozju tiegħek. Negozji oħra fis-suq ma jarawx l-imblukkar u ma jiġux affettwati minnu.",
            },
            { type: "h2", text: "Neħħi l-imblukkar mill-ġdid" },
            {
              type: "p",
              text: "Iftaħ Kont u hemmhekk Persuni Mblukkati. Agħżel l-entrata u ikklikkja Neħħi l-Imblukkar — il-mistieden imbagħad jerġa' jkun jista' jibgħat messaġġi u jipprenota.",
            },
          ],
        },
      ],
    },
  ],
};
