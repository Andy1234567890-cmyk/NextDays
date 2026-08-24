<?php
// Setzt die Umgebungsvariablen für den Seiten-Renderer und die eine fehlende
// Variable der web-App.
//
//   docker cp deploy/coolify/builder-env-setzen.php coolify:/tmp/
//   docker exec coolify php artisan tinker /tmp/builder-env-setzen.php
//
// Idempotent (Wurzel 2): ein zweiter Lauf aktualisiert nur, was abweicht.
//
// Über das Eloquent-Model, NICHT per SQL: Coolify verschlüsselt `value` über
// einen Model-Cast. Ein direkter INSERT schriebe Klartext in eine Spalte, die
// beim Lesen entschlüsselt wird — der Wert käme als Müll im Container an.
//
// Jede Variable wird ZWEIMAL angelegt (is_preview false und true), weil alle
// bestehenden Variablen dieser App es so halten. Fehlte die preview-Variante,
// hätte ein Preview-Deployment stillschweigend eine andere Konfiguration als
// die Produktion — und genau das fällt erst auf, wenn man es nicht braucht.

use App\Models\Application;
use App\Models\EnvironmentVariable;

/** Renderer-Origin. Erst der sslip.io-Host: er braucht keinen DNS-Eintrag. */
const RENDERER = 'https://lx65cb93ivz5il1suejtaz7g.65.21.144.136.sslip.io';
/** Dashboard-Origin — nur von dort darf der Renderer eingebettet werden. */
const DASHBOARD = 'https://app.mynextdays.com';
/** Backend. Derselbe Wert, den nextdays-web schon führt (ausgelesen, nicht geraten). */
const API = 'https://nextdays-api.65.21.144.136.sslip.io';

function setze(Application $app, string $key, string $wert, bool $buildtime, bool $runtime): void
{
    foreach ([false, true] as $preview) {
        $e = EnvironmentVariable::where('resourceable_type', Application::class)
            ->where('resourceable_id', $app->id)
            ->where('key', $key)
            ->where('is_preview', $preview)
            ->first();
        $lage = $preview ? 'preview' : 'produktion';
        if ($e) {
            if ($e->value === $wert && $e->is_buildtime == $buildtime && $e->is_runtime == $runtime) {
                echo "  = {$app->name}/{$key} ({$lage}) unveraendert\n";
                continue;
            }
            $e->value = $wert;
            $e->is_buildtime = $buildtime;
            $e->is_runtime = $runtime;
            $e->save();
            echo "  ~ {$app->name}/{$key} ({$lage}) aktualisiert\n";
            continue;
        }
        $e = new EnvironmentVariable();
        $e->key = $key;
        $e->value = $wert;
        $e->is_buildtime = $buildtime;
        $e->is_runtime = $runtime;
        $e->is_preview = $preview;
        $e->resourceable_type = Application::class;
        $e->resourceable_id = $app->id;
        $e->save();
        echo "  + {$app->name}/{$key} ({$lage}) neu\n";
    }
}

$builder = Application::where('name', 'nextdays-builder')->firstOrFail();
$web = Application::where('name', 'nextdays-web')->firstOrFail();

echo "Renderer:\n";
// buildtime ist bei DASHBOARD_ORIGIN Pflicht: next.config.ts liest es in
// headers(), und `next build` friert die Kopfzeilen in routes-manifest.json ein.
setze($builder, 'DASHBOARD_ORIGIN', DASHBOARD, true, true);
setze($builder, 'NEXT_PUBLIC_API_URL', API, true, true);

echo "Dashboard:\n";
// Ohne buildtime bliebe der Wert aus dem Client-Bundle UND aus der CSP heraus —
// die Vorschau zeigte weiter „nicht eingerichtet", obwohl die Variable gesetzt ist.
setze($web, 'NEXT_PUBLIC_BUILDER_URL', RENDERER, true, true);
