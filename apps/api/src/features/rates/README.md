# Slice: rates

Ratenpläne (`/api/v1/rates`): Liste (`GET`), Anlegen (`POST`), Ändern
(`PATCH /{rate_plan_id}`), Löschen (`DELETE /{rate_plan_id}`) sowie das
Setzen des Basispreises (`PUT /base-price`).

Die Preisauflösung zur Laufzeit (welcher Preis gilt an Tag X) liegt nicht
hier, sondern im zentralen Resolver des `pricing`-Slices.
