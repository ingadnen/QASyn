#!/usr/bin/env bash
set -e

cd "__REPO_DIR__"
mkdir -p /opt/qasyn/data /opt/qasyn/.qasyn-data
touch /opt/qasyn/.env
sed -i 's/\r$//' /opt/qasyn/.env || true
if ! grep -q '^QASYN_SECRET=' /opt/qasyn/.env 2>/dev/null; then
  if command -v openssl >/dev/null 2>&1; then
    qasyn_secret=$(openssl rand -hex 32)
  else
    qasyn_secret=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  fi
  printf 'QASYN_SECRET=%s\n' "$qasyn_secret" >> /opt/qasyn/.env
fi

# Preserve Hostinger Docker Manager environment values by merging the four
# production keys into /opt/qasyn/.env only when they are not already set.
if [ -f /docker/qasyn/docker-compose.yml ]; then
  for key in BIVIA_API_KEY BIVIA_API_URL NEXT_PUBLIC_APP_URL TZ; do
    if ! grep -q "^${key}=" /opt/qasyn/.env 2>/dev/null; then
      value=$(grep -E "^[[:space:]]*-?[[:space:]]*${key}[[:space:]]*[:=]" /docker/qasyn/docker-compose.yml | head -n 1 | sed -E "s/^[[:space:]]*-?[[:space:]]*${key}[[:space:]]*[:=][[:space:]]*//; s/^[\"']//; s/[\"']$//; s/[[:space:]]+#.*$//; s/[[:space:]]+$//" || true)
      if [ -n "$value" ]; then
        printf '%s=%s\n' "$key" "$value" >> /opt/qasyn/.env
      fi
    fi
  done
fi

git fetch --all
git reset --hard origin/main

docker build -t qasyn:latest .
docker rm -f qasyn >/dev/null 2>&1 || true
docker rm -f qasyn-qasyn-1 >/dev/null 2>&1 || true
docker run -d --name qasyn --restart unless-stopped -p 3000:3000 \
  --env-file /opt/qasyn/.env \
  -e DATABASE_URL="file:/app/prisma/data/qasyn.db" \
  -v /opt/qasyn/data:/app/prisma/data \
  -v /opt/qasyn/.qasyn-data:/app/.qasyn-data \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.qasyn.rule=Host(\`qasyn.com\`) || Host(\`www.qasyn.com\`) || Host(\`qasyn.io\`) || Host(\`www.qasyn.io\`) || Host(\`mail.qasyn.com\`) || Host(\`mail.qasyn.io\`)" \
  --label "traefik.http.routers.qasyn.entrypoints=websecure" \
  --label "traefik.http.routers.qasyn.tls.certresolver=letsencrypt" \
  --label "traefik.http.services.qasyn.loadbalancer.server.port=3000" \
  qasyn:latest

# Attach the container to every existing Traefik / compose network.
for net in $(docker network ls --format '{{.Name}}' | grep -E 'traefik|qasyn|root_default'); do
  docker network connect "$net" qasyn 2>/dev/null || true
done

# Keep the Hostinger Docker Manager compose file aligned with this deployment.
COMPOSE_FILE=/docker/qasyn/docker-compose.yml
if [ -f "$COMPOSE_FILE" ]; then
  sed -i -E 's|^([[:space:]]*)image:.*|\1image: qasyn:latest|' "$COMPOSE_FILE" || true
  if grep -qE '^[[:space:]]*env_file:' "$COMPOSE_FILE"; then
    sed -i -E 's|^([[:space:]]*)env_file:.*|\1env_file: /opt/qasyn/.env|' "$COMPOSE_FILE" || true
  else
    sed -i -E '/^([[:space:]]*)image: qasyn:latest/a\    env_file: /opt/qasyn/.env' "$COMPOSE_FILE" || true
  fi
  for volume in '/opt/qasyn/data:/app/prisma/data' '/opt/qasyn/.qasyn-data:/app/.qasyn-data'; do
    if ! grep -qF "$volume" "$COMPOSE_FILE"; then
      if grep -qE '^[[:space:]]*volumes:' "$COMPOSE_FILE"; then
        sed -i -E "/^([[:space:]]*)volumes:/a\\      - $volume" "$COMPOSE_FILE" || true
      else
        printf '    volumes:\n      - /opt/qasyn/data:/app/prisma/data\n      - /opt/qasyn/.qasyn-data:/app/.qasyn-data\n' >> "$COMPOSE_FILE"
      fi
    fi
  done
fi

sleep 3
docker ps --filter "name=qasyn" --format "{{.Names}} {{.Status}}"
docker logs --tail 20 qasyn || true
