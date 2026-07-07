// redirect to central login form
document.addEventListener('DOMContentLoaded', function () {
    var loginForm = document.forms.namedItem("loginForm");
    if (loginForm) {
        window.location.href = '/user';
    }
});
// logout function
function mc_logout() {
    fetch("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "logout=1"
    }).then(() => window.location.href = '/');
}

// Custom SOGo JS

// Change the visible font-size in the editor, this does not change the font of a html message by default
// WICHTIG: CKEDITOR ist nicht auf allen Seiten (z.B. Einstellungen) geladen.
// Ohne Guard wirft diese Zeile einen ReferenceError und bricht die restliche
// Datei ab -> nachfolgende Signatur-Helfer wuerden nie registriert.
if (typeof CKEDITOR !== 'undefined') {
  CKEDITOR.addCss("body {font-size: 16px !important}");
}

// Enable scayt by default
//CKEDITOR.config.scayt_autoStartup = true;

// ==========================================================================
// myNextDays: Mehrere Signaturen (Identitaeten) auf der Mail-Einstellungsseite
// verwalten — Auswahl per Dropdown + Anlegen / Umbenennen / Loeschen.
//
// SOGo bindet jede Signatur an eine Identitaet des primaeren Kontos
// (AuxiliaryMailAccounts[0].identities[]). Beim Speichern persistiert SOGo pro
// Identitaet: email, fullName, replyTo, signature, isDefault. Der Anzeigename
// ("Privat"/"Arbeit") = fullName der Identitaet.
//
// Wir haengen Helfer an den $rootScope (via .run des PreferencesUI-Moduls).
// Das Template ruft sie ueber "$root.mnd..." auf und uebergibt den Controller
// (app) explizit. Alles defensiv (try/catch, Null-Checks), damit ein Fehler
// die Einstellungsseite NICHT weiss macht.
// ==========================================================================
(function () {
  if (typeof angular === 'undefined') return;

  function primaryIdentities(app) {
    try {
      var accs = app && app.preferences && app.preferences.defaults &&
                 app.preferences.defaults.AuxiliaryMailAccounts;
      if (!accs || !accs.length) return null;
      if (!accs[0].identities) accs[0].identities = [];
      return accs[0].identities;
    } catch (e) { return null; }
  }

  try {
    angular.module('SOGo.PreferencesUI').run(['$rootScope', function ($rootScope) {

      // Liste der Signaturen (= editierbare Identitaeten) des primaeren Kontos.
      $rootScope.mndIdentities = function (app) {
        var ids = primaryIdentities(app);
        if (!ids) return [];
        return ids.filter(function (i) { return !i.isReadOnly; });
      };

      // Neue Signatur anlegen.
      $rootScope.mndAddSignature = function (app, form) {
        var ids = primaryIdentities(app);
        if (!ids) return;
        var base = ids.length ? ids[0] : { email: '', fullName: '' };
        ids.push({
          email: base.email || '',
          fullName: 'Neue Signatur',
          signature: '',
          isDefault: 0
        });
        app.mndSelectedIndex = ids.length - 1;
        if (form) form.$setDirty();
      };

      // Aktuell gewaehlte Signatur loeschen (mindestens eine bleibt).
      $rootScope.mndRemoveSignature = function (app, form) {
        var ids = primaryIdentities(app);
        if (!ids || ids.length <= 1) return;
        var idx = app.mndSelectedIndex || 0;
        if (idx < 0 || idx >= ids.length) idx = 0;
        ids.splice(idx, 1);
        app.mndSelectedIndex = 0;
        if (form) form.$setDirty();
      };

      // Die gerade gewaehlte Identitaet (fuer den Editor darunter).
      $rootScope.mndCurrent = function (app) {
        var ids = primaryIdentities(app);
        if (!ids || !ids.length) return null;
        var idx = app.mndSelectedIndex || 0;
        if (idx < 0 || idx >= ids.length) idx = 0;
        return ids[idx];
      };

    }]);
  } catch (e) { /* Modul nicht verfuegbar — Feature still deaktiviert, Seite bleibt heil */ }
})();
