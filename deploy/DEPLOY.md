# Deploying Dash Commerce OS

One VPS, one environment, deployed automatically by GitHub Actions:

```
local  --git push origin main-->  GitHub Actions  --rsync + restart-->  storeim.com
```

The reference target is one Ubuntu 24.04 host with 4 GB RAM and 50 GB of disk,
with DNS on Cloudflare. Substitute your own root domain and IP throughout — the
examples use `storeim.com` and `165.99.219.56`.

```
Caddy :80/:443
  ├── storeim.com, app.storeim.com   ──▶ 127.0.0.1:3000
  ├── <slug>.storeim.com             ──▶ 127.0.0.1:3000   cert issued on demand
  └── seller custom domains          ──▶ 127.0.0.1:3000   cert issued on demand
                                             │
                              PostgreSQL ────┘  dash_commerce, localhost only
```

**Nothing is built on the VPS.** A Next 16 build peaks around 2–3 GB, which does
not fit alongside a running server and a database on a 4 GB box — and building
there would slow the live site every time you deploy. GitHub Actions builds on an
`ubuntu-24.04` runner and rsyncs `.next` across; the server only runs `npm ci`,
`db:push` and a restart, which takes about a minute.

There is deliberately no control panel. cPanel/WHM cannot host this app without a
fight: it owns 80/443, its AutoSSL only issues for domains manually added to a
cPanel account (so seller custom domains would each be hand-registered), and it
costs ~1.5 GB of RAM.

---

## 1. Host preparation

SSH in as root, then:

```bash
adduser --disabled-password --gecos "" dash

apt update && apt upgrade -y
apt install -y git curl rsync ca-certificates ufw postgresql-client

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

**Swap.** Cheap insurance against a memory spike taking the site down:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

**SSH keys.** Put your own public key in `/home/dash/.ssh/authorized_keys`, then
in `/etc/ssh/sshd_config` set `PasswordAuthentication no` and
`PermitRootLogin prohibit-password`, and `systemctl restart ssh`.

**Let `dash` restart its own service.** The deploy script needs exactly one
command and nothing more:

```bash
cat > /etc/sudoers.d/dash-deploy <<'SUDO'
dash ALL=(root) NOPASSWD: /usr/bin/systemctl restart dash-web
SUDO
chmod 440 /etc/sudoers.d/dash-deploy
visudo -c
```

**Directories**, owned by `dash`:

```bash
mkdir -p /srv/dash-commerce /var/backups/dash
chown -R dash:dash /srv/dash-commerce /var/backups/dash
```

The first deploy fills `/srv/dash-commerce`; no manual `git clone` is needed.

## 2. Runtimes

```bash
# Node 22 LTS — match the runner in .github/workflows/deploy.yml
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# PostgreSQL 16
apt install -y postgresql postgresql-contrib

# Caddy 2, official repo
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

## 3. Database

`DATABASE_URL` carries a `?schema=` parameter that both the Prisma pg adapter and
the hand-written raw SQL in `modules/**` read (see CLAUDE.md). Create the schema
explicitly rather than relying on `db push` to do it:

```bash
sudo -u postgres psql -c "CREATE ROLE dash LOGIN PASSWORD 'CHANGE_ME_STRONG';"
sudo -u postgres psql -c "CREATE DATABASE dash_commerce OWNER dash;"
sudo -u postgres psql -d dash_commerce \
  -c "CREATE SCHEMA IF NOT EXISTS dash_commerce AUTHORIZATION dash;"
```

Use only letters, digits and `-_.` in the password. PostgreSQL listens on
localhost only by default on Ubuntu — leave it that way. Nothing outside the box
needs port 5432.

## 4. DNS (Cloudflare)

| Type | Name      | Content       | Proxy status |
| ---- | --------- | ------------- | ------------ |
| A    | `@`       | 165.99.219.56 | DNS only     |
| A    | `app`     | 165.99.219.56 | DNS only     |
| A    | `*`       | 165.99.219.56 | DNS only     |
| A    | `connect` | 165.99.219.56 | DNS only     |

The wildcard is not optional: every store gets `<slug>.storeim.com`, resolved by
`lib/host-routing.ts`.

**Keep the orange cloud off.** With Cloudflare proxying, Caddy sees Cloudflare's
IP instead of the visitor's, and on-demand TLS for seller custom domains stops
working because the TLS handshake never reaches this server.

`connect.storeim.com` is what sellers CNAME their own domains to
(`PLATFORM_DOMAIN_CNAME`). Offering a CNAME rather than a bare IP means this
server can change address without every seller editing their DNS.

## 5. Environment file

Write `/srv/dash-commerce/.env` as the `dash` user — repo root, **not**
`apps/web/.env`. The app dotenv-loads this exact path:

```bash
DATABASE_URL="postgresql://dash:CHANGE_ME_STRONG@127.0.0.1:5432/dash_commerce?schema=dash_commerce"

NEXTAUTH_SECRET="paste output of: openssl rand -base64 48"
NEXTAUTH_URL="https://app.storeim.com"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

PLATFORM_ROOT_DOMAIN="storeim.com"
PLATFORM_APP_HOST="app.storeim.com"

DOMAIN_AUTHORIZE_TOKEN="paste 24 random bytes as hex"
PLATFORM_DOMAIN_IPV4="165.99.219.56"
PLATFORM_DOMAIN_CNAME="connect.storeim.com"

COURIER_CREDENTIALS_KEY="paste 32 random bytes as base64"
STORAGE_DRIVER="local"
```

Generate the random values with the commands `.env.example` documents:

```bash
openssl rand -base64 48                                                          # NEXTAUTH_SECRET
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"    # DOMAIN_AUTHORIZE_TOKEN
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))" # COURIER_CREDENTIALS_KEY
chmod 600 /srv/dash-commerce/.env
```

Notes:

- `NEXTAUTH_URL` must be exactly the seller-app origin, because Google OAuth
  redirect URIs cannot contain wildcards. Register
  `https://app.storeim.com/api/auth/callback/google` in the Google Cloud console.
  The Google provider only registers when both client variables are set, so
  leaving them empty is a valid launch state.
- `COURIER_CREDENTIALS_KEY` encrypts stored courier API credentials at rest.
  Changing it makes every saved credential undecryptable, so generate it once and
  back it up with the database.

## 6. systemd

```bash
cp /srv/dash-commerce/deploy/dash-web.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable dash-web
```

It will not start until the first deploy has put code in place. That is expected.

## 7. Caddy

Copy `deploy/Caddyfile` to `/etc/caddy/Caddyfile` and make two edits:

1. `email admin@storeim.com` → a real address (Let's Encrypt expiry notices).
2. `?token=REPLACE_WITH_DOMAIN_AUTHORIZE_TOKEN` → the value in `.env`.

If your domain is not `storeim.com`, replace it throughout the file as well.

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
journalctl -u caddy -f
```

**One thing to watch as you grow.** Every `<slug>.storeim.com` certificate counts
against the same limit of 50 per registered domain per week. Past roughly 50 new
stores in a week, store number 51 silently fails to get one. The fix is a single
wildcard certificate, which needs the Cloudflare DNS plugin — the exact block is
commented at the bottom of `deploy/Caddyfile`. Not urgent on day one.

## 8. GitHub setup

**A deploy key for Actions.** Generate it on the server, as `dash`:

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions" -f ~/.ssh/deploy_key
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/deploy_key          # the private half, for the secret below
ssh-keyscan -H 165.99.219.56   # the known_hosts line, for the secret below
```

**Repository secrets** (Settings → Secrets and variables → Actions):

| Secret               | Value                                    |
| -------------------- | ---------------------------------------- |
| `DEPLOY_SSH_KEY`     | the whole private key, including headers |
| `DEPLOY_HOST`        | `165.99.219.56`                          |
| `DEPLOY_USER`        | `dash`                                   |
| `DEPLOY_KNOWN_HOSTS` | the `ssh-keyscan` output                 |

**Optional approval gate.** `deploy.yml` names a GitHub Environment called
`production`. Create it under Settings → Environments and add yourself as a
required reviewer, and every deploy will build, then wait for your approval
before touching the live database. Leave the environment without protection rules
if you would rather have push mean live.

## 9. First deploy

```bash
git push origin main
```

Watch the Actions run. It installs, pushes the schema to a throwaway Postgres,
lints, typechecks, builds, rsyncs to `/srv/dash-commerce`, then runs
`deploy/bin/release.sh`, which does `npm ci`, `db:generate`, a `pg_dump` backup,
`db:push`, a restart and a health check. If the health check fails the run turns
red and prints the last 40 log lines.

## 10. Smoke test

Each step exercises a different branch of the routing chain in
`apps/web/src/proxy.ts`.

1. `https://storeim.com` renders the marketing page.
2. `https://app.storeim.com/register` — create the account whose email matches
   `platformOwnerEmail` in `lib/auth.ts`. It is force-promoted to `ADMIN` on
   every sign-in, which is how you reach `/admin`.
3. Complete onboarding, create a store, note its slug.
4. `https://<slug>.storeim.com` renders the storefront, with a certificate issued
   on the fly.
5. Upload a product image, then deploy again and confirm it is still there. This
   is the check that the uploads exclusion in the rsync is working.
6. Point a spare domain's A record at the server, add it under
   `/dashboard/settings/domains`, verify it, then load it. Watch
   `journalctl -u caddy -f` while you do — this is the on-demand TLS path.

Several tables are created by idempotent DDL on first request rather than by
`db push` (search, taxonomy, variants, courier, category images, demo content —
see CLAUDE.md). Visiting the storefront and the dashboard once after a deploy is
what triggers them.

## 11. Day-to-day

```bash
git add . && git commit -m "Add product feature"
git push origin main           # -> live, automatically
```

Work on a branch and open a pull request when you want the checks to run before
merging; `ci.yml` runs lint, typecheck and build on every pull request.

**Rollback.** The fastest safe path is a revert, because it goes through the same
tested pipeline:

```bash
git revert --no-edit <bad-commit>
git push origin main
```

Rolling back code does **not** roll back the database. If the bad deploy changed
the schema, restore the dump `release.sh` took just before it:

```bash
ls -1t /var/backups/dash/            # newest first
pg_restore --clean --if-exists -d "postgresql://dash:PASS@127.0.0.1/dash_commerce" \
  /var/backups/dash/predeploy-<stamp>.dump
```

## 12. Disk and backups

50 GB fills up quietly. Three things grow:

| Path                      | Growth                                      |
| ------------------------- | ------------------------------------------- |
| `apps/web/public/uploads` | every seller's media, forever               |
| `/var/backups/dash`       | one dump per deploy — `release.sh` keeps 14 |
| `/var/lib/postgresql`     | the database itself                         |

`STORAGE_DRIVER=local` writes to `apps/web/public/uploads`; the S3/R2 driver in
`modules/media/storage.ts` throws, it is not implemented. That directory is the
only copy of every seller's media, and it is excluded from the rsync so deploys
never touch it.

Check with `df -h` and `du -sh /srv/dash-commerce/apps/web/public/uploads` now and
then. When uploads outgrow the disk, that is the signal to implement the S3
driver rather than to buy a bigger box.

Add a nightly dump, and copy both it and the uploads off the server — a backup on
the same disk is not a backup:

```bash
sudo -u postgres pg_dump -Fc dash_commerce > /var/backups/dash/nightly-$(date +%F).dump
tar czf /var/backups/dash/uploads-$(date +%F).tar.gz \
  -C /srv/dash-commerce/apps/web/public uploads
```

Back up `.env` separately and encrypted — without `COURIER_CREDENTIALS_KEY` the
courier credentials inside a restored database cannot be decrypted.

## 13. Known gotchas

| Symptom                               | Cause                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Seller custom domains get no cert     | Cloudflare proxy (orange cloud) is on, or `DOMAIN_AUTHORIZE_TOKEN` and the Caddyfile `ask` URL disagree |
| `<slug>.storeim.com` does not resolve | Missing `*` wildcard A record                                                                           |
| Uploads vanished after a deploy       | The rsync `--exclude='apps/web/public/uploads/'` line was removed                                       |
| Deploy hangs at "Release"             | The `sudoers.d/dash-deploy` rule is missing, so `systemctl restart` is prompting for a password         |
| Health check fails, unit is dead      | `journalctl -u dash-web -n 50` — usually a missing variable in `.env`                                   |
| Google sign-in redirect mismatch      | `NEXTAUTH_URL` is not exactly the origin registered in Google Cloud                                     |
| First image upload crashes            | `node_modules` was copied instead of installed; re-run `npm ci` on the server                           |
| A new store's storefront 404s         | Its slug collides with a platform subdomain — see `RESERVED_SUBDOMAINS` in `lib/host-routing.ts`        |
