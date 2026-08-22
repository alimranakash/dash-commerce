#!/usr/bin/env bash
#
# Finish a deploy on the server. GitHub Actions rsyncs the built tree to
# /srv/dash-commerce and then runs this over SSH:
#
#   bash /srv/dash-commerce/deploy/bin/release.sh
#
# Safe to run by hand for a manual deploy or after a rollback.
#
# What is NOT here: next build. The workflow builds on the runner and ships
# .next, because a Next build peaks around 2-3 GB — more than is free on a 4 GB
# box that is already serving the site and a database.
set -euo pipefail

ROOT="/srv/dash-commerce"
PORT=3000
cd "$ROOT"

if [ ! -f .env ]; then
  echo "missing $ROOT/.env — see deploy/DEPLOY.md step 5" >&2
  exit 1
fi

# node_modules is deliberately not rsynced: npm workspaces link packages with
# symlinks and sharp installs a platform-specific binary, both of which are safer
# rebuilt here than copied from the runner.
echo "installing dependencies..."
npm ci --no-audit --no-fund

echo "generating prisma client..."
npm run db:generate

# --- Relink Turbopack's externalised packages --------------------------------
# next build rewrites native/server-only packages to content-hashed aliases
# (@prisma/client-<hash>) and satisfies them with symlinks under
# .next/node_modules that point into the build machine's own node_modules. The
# workflow's --exclude='node_modules/' has no leading slash, so it matches at
# every depth and that directory never ships; its absolute targets would be
# wrong here anyway. Rebuild it against the node_modules npm ci just installed.
# Reading the aliases back out of the build means a changed hash needs no edit
# here. The `|| true` matters: with `set -o pipefail` a build that happens to
# externalise nothing would otherwise fail the deploy.
echo "relinking externalised packages..."
NEXT_NM="$ROOT/apps/web/.next/node_modules"
{ grep -rohE '"[@a-z0-9/._-]+-[0-9a-f]{16}' "$ROOT/apps/web/.next/server" 2>/dev/null || true; } \
  | tr -d '"' | sed -E 's#.*node_modules/##' | sort -u | while read -r alias; do
      real="${alias%-*}"
      [ -d "$ROOT/node_modules/$real" ] || continue
      mkdir -p "$NEXT_NM/$(dirname "$alias")"
      ln -sfn "$ROOT/node_modules/$real" "$NEXT_NM/$alias"
      echo "  $alias -> node_modules/$real"
    done

# Read DATABASE_URL exactly the way the app does, with dotenv, rather than
# sourcing .env in the shell — that would expand a $ or a backtick in the
# password. This has to come after npm ci, which is what installs dotenv.
DATABASE_URL="$(node -e 'require("dotenv").config({ path: ".env", quiet: true }); process.stdout.write(process.env.DATABASE_URL || "")')"
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set in $ROOT/.env" >&2
  exit 1
fi

# --- Back up before touching the schema --------------------------------------
# There is no migrations/ directory in this repo: db:push diffs the live database
# against schema.prisma and will drop a column that no longer appears there. That
# is one bad merge away from data loss, so always dump first.
mkdir -p /var/backups/dash
STAMP="$(date +%Y%m%d-%H%M%S)"
# libpq rejects the ?schema= parameter Prisma puts in DATABASE_URL, so strip the
# query string before handing the URL to pg_dump.
pg_dump -Fc "${DATABASE_URL%%\?*}" > "/var/backups/dash/predeploy-$STAMP.dump"
echo "backed up to /var/backups/dash/predeploy-$STAMP.dump"
# Keep the last fourteen; drop the rest. 50 GB of disk does not hold them forever.
ls -1t /var/backups/dash/predeploy-*.dump | tail -n +15 | xargs -r rm --

echo "syncing schema..."
npm run db:push

echo "restarting dash-web..."
sudo systemctl restart dash-web

# --- Health check -------------------------------------------------------------
# Next needs a moment to bind the port. Fail the deploy rather than leaving a dead
# unit behind a green pipeline.
printf 'waiting for 127.0.0.1:%s ' "$PORT"
for attempt in $(seq 1 30); do
  if curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:$PORT/"; then
    echo "-> up after ${attempt}s"
    exit 0
  fi
  printf '.'
  sleep 1
done

echo
echo "health check failed; last 40 log lines:" >&2
journalctl -u dash-web -n 40 --no-pager >&2
exit 1
