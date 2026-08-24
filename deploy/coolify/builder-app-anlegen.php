<?php
// Legt die Coolify-Resource `nextdays-builder` an — den Seiten-Renderer der
// Kunden-Websites (builder/).
//
// Einmalig auszuführen; ein zweiter Lauf tut nichts (idempotent, Wurzel 2):
//
//   docker cp deploy/coolify/builder-app-anlegen.php coolify:/tmp/
//   docker exec coolify php artisan tinker /tmp/builder-app-anlegen.php
//
// Über das Eloquent-Model und NICHT per SQL-Insert: nur so feuern Coolifys
// Model-Events, die u. a. die `application_settings`-Zeile erzeugen. Eine App
// ohne diese Zeile sieht in der Oberfläche normal aus und bricht beim ersten
// Deploy ab.
//
// Vorlage ist `nextdays-web` (build_pack=dockerfile, Root-Kontext) — dieselbe
// Bauart, weil builder/ dieselben Workspace-Pakete braucht.

use App\Models\Application;

// FESTE UUID, nicht generiert: sie steht bereits in scripts/ci/coolify-apps.txt,
// in der Slice-Kopie und in der images-Matrix. Würde Coolify hier eine eigene
// erzeugen, liefen die Listen auseinander und `apps-liste-pruefen.sh` schlüge
// fail-closed fehl — oder, schlimmer, der deploy-Job deployte ins Leere.
const UUID = 'lx65cb93ivz5il1suejtaz7g';

$vorhanden = Application::where('name', 'nextdays-builder')->first();
if ($vorhanden) {
    echo "SCHON DA|{$vorhanden->uuid}|{$vorhanden->fqdn}\n";
    if ($vorhanden->uuid !== UUID) {
        echo "WARNUNG: UUID weicht von den Repo-Listen ab (" . UUID . ")\n";
    }
    exit(0);
}

$a = new Application();
$a->uuid = UUID;
$a->name = 'nextdays-builder';
$a->description = 'Seiten-Renderer der Kunden-Websites (builder/). Liefert die '
    . 'im Website-Baukasten komponierten Seiten pro Custom-Domain aus und ist '
    . 'das Ziel der Entwurfs-Vorschau im Dashboard.';
$a->git_repository = 'git@github.com:Nextdays-AirSmil/NextDays.git';
$a->git_branch = 'main';
$a->build_pack = 'dockerfile';
// Root-Kontext: builder/package.json führt @nextdays/* als workspace:* — mit
// builder/ als Kontext gäbe es kein packages/ und `bun install` scheitert.
$a->base_directory = '/';
$a->dockerfile_location = '/builder/Dockerfile';
$a->ports_exposes = '3000';
// Wie nextdays-web: der Coolify-eigene Healthcheck bleibt aus, der HEALTHCHECK
// im Image wirkt trotzdem (Traefik schaltet erst nach „healthy" um).
$a->health_check_enabled = false;
$a->health_check_path = '/healthz';
$a->destination_type = 'App\Models\StandaloneDocker';
$a->destination_id = 0;
$a->environment_id = 1;
$a->private_key_id = 1;
// MUSS mit scripts/ci/coolify-apps.txt übereinstimmen, sonst deployt Coolify
// auf einen Push, den die CI als „betrifft diese App nicht" gewertet hat.
$a->watch_paths = "builder/**\npackages/**";
// Erst der sslip.io-Host: er funktioniert ohne DNS-Eintrag, die Vorschau im
// Baukasten läuft damit sofort. Eine eigene Subdomain kommt später DAZU, nicht
// an seine Stelle — nextdays-web führt aus demselben Grund beide.
$a->fqdn = 'https://' . UUID . '.65.21.144.136.sslip.io';
$a->save();

// Gegenprüfen statt annehmen (Wurzel 5).
$a->refresh();
$settings = \DB::table('application_settings')->where('application_id', $a->id)->count();
echo "ANGELEGT|{$a->uuid}|{$a->fqdn}|settings={$settings}\n";
if ($settings !== 1) {
    echo "FEHLER: keine application_settings-Zeile — Deploy würde abbrechen.\n";
    exit(1);
}
