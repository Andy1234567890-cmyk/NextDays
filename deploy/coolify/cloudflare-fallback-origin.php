<?php
// Setzt CLOUDFLARE_FALLBACK_ORIGIN für nextdays-api und nextdays-worker.
//
//   docker cp deploy/coolify/cloudflare-fallback-origin.php coolify:/tmp/
//   docker exec coolify php artisan tinker /tmp/cloudflare-fallback-origin.php
//
// Der Wert ist KEIN Secret: es ist der Host, auf den Cloudflare die
// Kunden-Domains leitet — also der Origin der Renderer-App `nextdays-builder`.
// Er steht hier, weil genau dieser Wert am leichtesten falsch gesetzt wird:
// naheliegend, aber falsch wäre die Dashboard-Domain app.mynextdays.com. Dort
// liegen die Kunden-Websites nicht.
//
// Die beiden anderen Felder (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID) bleiben
// bewusst offen — sie sind Secrets und gehören aus dem Passwort-Manager
// eingetragen. Der Cloudflare-Client ist fail-closed: solange eines der drei
// fehlt, antworten die Domain-Endpunkte mit 503. Der übrige Baukasten läuft.
use App\Models\Application;
use App\Models\EnvironmentVariable;

const WERT = 'https://lx65cb93ivz5il1suejtaz7g.65.21.144.136.sslip.io';

foreach (['nextdays-api', 'nextdays-worker'] as $name) {
    $app = Application::where('name', $name)->first();
    if (!$app) { echo "{$name}: nicht gefunden\n"; continue; }
    foreach ([false, true] as $preview) {
        $e = EnvironmentVariable::where('resourceable_type', Application::class)
            ->where('resourceable_id', $app->id)
            ->where('key', 'CLOUDFLARE_FALLBACK_ORIGIN')
            ->where('is_preview', $preview)->first();
        if ($e && $e->value === WERT) {
            echo "  = {$name} (" . ($preview ? 'preview' : 'produktion') . ") unveraendert\n";
            continue;
        }
        if (!$e) {
            $e = new EnvironmentVariable();
            $e->key = 'CLOUDFLARE_FALLBACK_ORIGIN';
            $e->is_preview = $preview;
            $e->resourceable_type = Application::class;
            $e->resourceable_id = $app->id;
        }
        $e->value = WERT;
        $e->is_runtime = true;
        $e->is_buildtime = false;
        $e->save();
        echo "  + {$name} (" . ($preview ? 'preview' : 'produktion') . ") gesetzt\n";
    }
}
