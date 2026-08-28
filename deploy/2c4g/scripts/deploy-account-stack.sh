#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy_dir="$(cd "${script_dir}/.." && pwd)"
repo_root="$(cd "${deploy_dir}/../.." && pwd)"
compose_file="${deploy_dir}/docker-compose.account.yml"
env_file="${deploy_dir}/.env.account"

if [[ ! -f "${env_file}" ]]; then
  echo "Missing ${env_file}. Copy .env.account.example and fill every required secret." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

required=(MYSQL_ROOT_PASSWORD DB_PASSWORD REDIS_PASSWORD BETTER_AUTH_SECRET DEN_DB_ENCRYPTION_KEY EMAIL_FROM)
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required value: ${key}" >&2
    exit 1
  fi
done

if [[ -z "${RESEND_API_KEY:-}" && -z "${SMTP_HOST:-}" ]]; then
  echo "Production email is not configured. Set RESEND_API_KEY or SMTP_HOST before deploying." >&2
  exit 1
fi

if ! getent hosts account.rrenn.com >/dev/null 2>&1; then
  echo "account.rrenn.com does not resolve yet. Add its DNS A record before deploying." >&2
  exit 1
fi

if [[ ! -s /etc/letsencrypt/live/account.rrenn.com/fullchain.pem || ! -s /etc/letsencrypt/live/account.rrenn.com/privkey.pem ]]; then
  echo "TLS certificate for account.rrenn.com is missing. Issue it with Certbot first." >&2
  exit 1
fi

cd "${repo_root}"
docker compose --env-file "${env_file}" -f "${compose_file}" config --quiet
docker compose --env-file "${env_file}" -f "${compose_file}" build den-api den-web
docker compose --env-file "${env_file}" -f "${compose_file}" up -d mysql redis den-api den-web

curl --fail --silent --show-error --retry 30 --retry-delay 2 https://account.rrenn.com/api/ready >/dev/null
curl --fail --silent --show-error --retry 30 --retry-delay 2 https://account.rrenn.com/api/health >/dev/null

echo "RenWork account stack is healthy at https://account.rrenn.com"
