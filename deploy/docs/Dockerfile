# API-Referenz (docs.mynextdays.com) — statische Site auf nginx.
# Rein statisch: kein Node-Build, kein Backend, keine Secrets im Image.
FROM nginx:1.27-alpine

# nginx als non-root: auf Port 8080 lauschen (kein privilegierter Port nötig).
RUN sed -i 's/user  nginx;/# user nginx;/' /etc/nginx/nginx.conf

# Unsere Server-Config ERSETZT nginx' mitgelieferte conf.d/default.conf.
COPY deploy/docs/nginx.conf /etc/nginx/conf.d/default.conf

COPY deploy/docs/site/ /usr/share/nginx/html/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1
