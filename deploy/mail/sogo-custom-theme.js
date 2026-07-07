/*
 * myNextDays — Theme für den SOGo-Webmailer (mail.mynextdays.dk/SOGo)
 * ---------------------------------------------------------------------------
 * Wird auf dem Mailserver nach data/conf/sogo/custom-theme.js kopiert.
 * Mailcow mountet diese Datei als theme.js in den SOGo-Container
 * (docker-compose.yml: custom-theme.js -> WebServerResources/js/theme.js),
 * und theme.js steht in der Ladeliste der sogo.conf -> wird wirklich geladen.
 *
 * SOGo = AngularJS Material. Farben werden über $mdThemingProvider-Paletten
 * gesetzt (nicht über CSS). Material-Paletten brauchen Hue-Stufen 50..900
 * plus contrast*Color-Listen, sonst sind Icons/Text unlesbar.
 *
 * Markenfarben = identisch apps/web/app/globals.css (keine erfundenen Werte):
 *   Schwarz  #0a0a0a  (Primär: Kopfleiste, Sidebar-Akzent, aktive Mail)
 *   Rot      #b82028  (Akzent: FAB "Schreiben", Buttons, Fokus)
 */
(function() {
  'use strict';
  angular.module('SOGo.Common')
    .config(configure);

  configure.$inject = ['$mdThemingProvider'];
  function configure($mdThemingProvider) {

    // --- Primär-Palette: myNextDays-Schwarz (Kopfleiste, aktive Elemente) ---
    // Abstufungen von hell nach dunkel um #0a0a0a herum.
    $mdThemingProvider.definePalette('mnd-black', {
      '50':  'f4f4f5',
      '100': 'e4e4e7',
      '200': 'd4d4d8',
      '300': 'a1a1aa',
      '400': '52525b',
      '500': '0a0a0a',   // Marken-Schwarz
      '600': '0a0a0a',
      '700': '000000',
      '800': '000000',
      '900': '000000',
      'A100': 'd4d4d8',
      'A200': '71717a',
      'A400': '262626',
      'A700': '0a0a0a',
      'contrastDefaultColor': 'light',
      'contrastDarkColors': ['50', '100', '200', '300'],
      'contrastLightColors': ['400', '500', '600', '700', '800', '900', 'A200', 'A400', 'A700']
    });

    // --- Akzent-Palette: myNextDays-Rot (FAB, Buttons, aktive Auswahl) ---
    $mdThemingProvider.definePalette('mnd-red', {
      '50':  'fbe9ea',
      '100': 'f4c4c7',
      '200': 'ec9ba0',
      '300': 'e37279',
      '400': 'dd545c',
      '500': 'b82028',   // Marken-Rot
      '600': 'a71d24',
      '700': '9a1a21',
      '800': '85161c',
      '900': '6b1116',
      'A100': 'ff8a8f',
      'A200': 'ff575e',
      'A400': 'ff242d',
      'A700': 'b82028',
      'contrastDefaultColor': 'light',
      'contrastDarkColors': ['50', '100', '200', '300', 'A100'],
      'contrastLightColors': ['400', '500', '600', '700', '800', '900', 'A200', 'A400', 'A700']
    });

    // --- ruhiger grauer Hintergrund (statt SOGo-Frost) ---
    var mndGrey = $mdThemingProvider.extendPalette('grey', {
      '50':  'ffffff',
      '100': 'f4f4f5',
      '200': 'e4e4e7',
      '300': 'd4d4d8'
    });
    $mdThemingProvider.definePalette('mnd-grey', mndGrey);

    // --- Default-Theme neu verdrahten: Schwarz primär, Rot Akzent ---
    $mdThemingProvider.theme('default')
      .primaryPalette('mnd-black', {
        'default': '500',
        'hue-1':   '400',
        'hue-2':   '600',
        'hue-3':   '900'
      })
      .accentPalette('mnd-red', {
        'default': '500',
        'hue-1':   '300',
        'hue-2':   '600',
        'hue-3':   '900'
      })
      .warnPalette('mnd-red')
      .backgroundPalette('mnd-grey');

    // SOGo generiert Themes statisch (nicht on-demand) -> false lassen.
    $mdThemingProvider.generateThemesOnDemand(false);
  }
})();
