-- 0001_extensions.sql — benötigte Postgres-Extensions
-- pgcrypto liefert gen_random_uuid() für alle Primärschlüssel.

create extension if not exists pgcrypto;
