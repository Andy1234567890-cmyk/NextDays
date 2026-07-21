# API-Referenz (docs.mynextdays.com) — statische Site auf nginx.
# Rein statisch: kein Node-Build, kein Backend, keine Secrets im Image.
FROM nginx:1.27-alpine

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
