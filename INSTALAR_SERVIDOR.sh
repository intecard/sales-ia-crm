#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v docker >/dev/null 2>&1; then
  echo "Instale Docker Engine y Docker Compose antes de continuar."
  exit 1
fi
if [ ! -f .env.cloud ]; then
  echo "Falta .env.cloud. Copie .env.cloud.example, configure el dominio y los secretos."
  exit 1
fi
docker compose --env-file .env.cloud -f compose.cloud.yml up -d --build --wait --wait-timeout 300
echo "Servicio iniciado. Compruebe https://$(sed -n 's/^CRM_DOMAIN=//p' .env.cloud)/api/ready"
