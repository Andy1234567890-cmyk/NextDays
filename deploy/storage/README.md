# NextDays — Medien: Supabase-Storage → Hetzner Object Storage (S3)

Verlagert die Gäste-Medien (Fotos/Belege) vom App-Server-Volume in **Hetzner
Object Storage** (S3-kompatibel), um die Disk zu entlasten. Infra-Runbook Punkt 3.

**Migration ist additiv & verlustfrei:** erst kopieren + Prüfsummen verifizieren,
dann Cutover, dann erst — nach grüner Verifikation — das lokale Verzeichnis leeren.

## Verifizierte Mechanik (storage-api v1.60.4)
- **Die DB bleibt unverändert.** `storage.objects` ist backend-agnostisch; storage-api
  baut den physischen Object-Key zur Laufzeit aus `bucket_id` + `name` + `version`.
- **S3-Key = Disk-Pfad ohne den Bucket-Präfixordner.** On-Disk liegt eine Datei unter
  `…/storage/<GLOBAL_S3_BUCKET>/storage-single-tenant/<bucket>/<name>/<version>`.
  Im S3-Bucket lautet der Key `storage-single-tenant/<bucket>/<name>/<version>` —
  der `<GLOBAL_S3_BUCKET>`-Ordner (hier `stub`) entspricht dem S3-Bucket selbst.
- Getestet (MinIO-Staging): Bestandsobjekte über eine S3-storage-api gelesen,
  **MD5 identisch** mit dem Original auf Disk.

---

## ⚙️ Andys manueller Schritt (Hetzner-Konto) — VORAUSSETZUNG

1. **Object-Storage-Bucket anlegen** (EU-Region, z. B. Falkenstein `fsn1`):
   Bucketname z. B. `nextdays-media`. **Sichtbarkeit: privat** (kein öffentlicher
   Bucket-Zugriff — der Zugriff läuft ausschließlich über die storage-api).
2. **S3-Credentials erzeugen** (Access-Key + Secret) mit Schreibrecht auf den Bucket.
3. **In Coolify-Env** des `storage`-Service setzen (NICHT ins Repo):
   ```
   STORAGE_S3_ENDPOINT=https://fsn1.your-objectstorage.com
   STORAGE_S3_REGION=fsn1
   STORAGE_S3_BUCKET=nextdays-media
   AWS_ACCESS_KEY_ID=<key>
   AWS_SECRET_ACCESS_KEY=<secret>
   ```
   `STORAGE_BACKEND` zunächst noch auf `file` lassen — erst nach der Kopie umstellen.

> S3-Bucket-Versionierung ist **nicht nötig**: storage-api versioniert selbst über
> die Version-UUID im Key. Bucket bleibt privat; Bilder bleiben trotzdem sichtbar,
> weil sie über die storage-api (public-URL/RLS) ausgeliefert werden, nicht direkt.

---

## 1) Kopie + Prüfsummen-Verifikation
Auf dem Server (als root), mit den S3-Werten in der Umgebung:
```bash
# Trockenlauf — zeigt nur, was kopiert würde:
STORAGE_S3_ENDPOINT=https://fsn1.your-objectstorage.com \
STORAGE_S3_BUCKET=nextdays-media STORAGE_S3_REGION=fsn1 \
AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… \
bash deploy/storage/migrate-storage-to-s3.sh

# Real kopieren + verifizieren:
… bash deploy/storage/migrate-storage-to-s3.sh --apply
```
Das Skript bricht ab, wenn die Prüfsummen Quelle↔Ziel nicht 100 % übereinstimmen.

## 2) Cutover
1. In Coolify-Env: **`STORAGE_BACKEND=s3`** setzen (die `STORAGE_S3_*`/`AWS_*` stehen schon).
2. `storage`-Service neu deployen.
3. **Verifikation (Pflicht, vor „fertig"):**
   - Bestehendes Bild in der App anzeigen (Galerie/Logo) → lädt.
   - Neuen Upload machen → erscheint im Bucket (`mc/rclone ls`), **nicht** mehr unter
     `…/nextdays/storage/`.
   - RLS: `anon` kommt nicht an ein privates/fremdes Objekt (öffentliche Bilder bleiben
     bewusst sichtbar — siehe Public/Privat unten).
4. **Disk-Effekt zeigen:** `du -sh /mnt/HC_Volume_106086998/nextdays/storage` vorher/nachher.

## 3) Lokales Verzeichnis leeren (erst nach grüner Verifikation!)
Das Bind-Mount bleibt als Fallback bestehen; nur den Inhalt entfernen, wenn der
S3-Betrieb bestätigt ist:
```bash
# NUR nach erfolgreicher Verifikation:
find /mnt/HC_Volume_106086998/nextdays/storage/stub -type f -delete
```

---

## Public/Privat (Produktentscheidung)
- `property-images` / `company-logos`: bleiben **öffentlich** (`public=t`) — die
  Galerie/Logos werden im Buchungsportal/Marketing öffentlich angezeigt. Ausgeliefert
  über die storage-api (public-URL), der Hetzner-Bucket bleibt dennoch privat.
- **Künftige PII-Beleg-Buckets** (`documents`, `invoices`, `ocr`): bei Anlage **privat
  (`public=false`) + signierte URLs** (`create_signed_url`). Diese Buckets existieren
  noch nicht — die Pflicht ist hier dokumentiert, damit sie korrekt entstehen.

## Backup
`deploy/backup/backup.sh` erkennt die S3-Variablen automatisch und sichert nach dem
Cutover das **Bucket** (statt des leeren lokalen Verzeichnisses) — zweite,
verschlüsselte Kopie auf der Storage Box. Damit keine Backup-Lücke entsteht, die
`STORAGE_S3_*`/`AWS_*`-Werte auch in `/etc/nextdays-backup.env` eintragen.

## Bewusst NICHT Teil
Eigene Domain/CDN vor dem Bucket, Multi-Node-Storage, Medien-Transformationen.
