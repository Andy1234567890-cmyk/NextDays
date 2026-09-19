# API-Referenz (docs.mynextdays.com) — statische Site auf nginx.
# Rein statisch: kein Node-Build, kein Backend, keine Secrets im Image.
FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10

# nginx als non-root: auf Port 8080 lauschen (kein privilegierter Port nötig).
RUN sed -i 's/user  nginx;/# user nginx;/' /etc/nginx/nginx.conf

# Unsere Server-Config ERSETZT nginx' mitgelieferte conf.d/default.conf.
COPY deploy/docs/nginx.conf /etc/nginx/conf.d/default.conf

COPY deploy/docs/site/ /usr/share/nginx/html/

EXPOSE 8080

# 127.0.0.1 statt localhost: im Container löst localhost auf ::1 (IPv6) auf,
# nginx lauscht aber nur auf IPv4 → sonst „connection refused" im Healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
