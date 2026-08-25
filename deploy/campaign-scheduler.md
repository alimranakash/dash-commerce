# Campaign scheduler

Marketing campaigns send in batches. Something has to ask for the next batch on a
timer, because this project runs no worker process — `apps/worker` is a
placeholder. That something calls one endpoint:

```
POST /api/cron/campaigns
Authorization: Bearer $CRON_SECRET
```

Each call starts campaigns whose scheduled time has arrived, advances the ones
already sending, and returns within about 45 seconds. Calling it when nothing is
due does nothing, so erring towards calling it often is safe.

**Without this, scheduled campaigns never send.** They sit in `SCHEDULED` until
someone opens the campaign page, which drives batches from the browser instead.
The campaign detail page says so when `CRON_SECRET` is unset.

## 1. Set the secret

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put it in the repo-root `.env` as `CRON_SECRET=…` and restart the app. While it
is unset the endpoint answers `503` and refuses to do anything — an
unauthenticated way to make a server send thousands of SMS is not something to
leave open by forgetting a variable.

## 2. Run it on a timer

### systemd (recommended alongside `dash-web.service`)

`/etc/systemd/system/dash-campaigns.service`:

```ini
[Unit]
Description=StoreIM campaign scheduler tick
After=network-online.target dash-web.service

[Service]
Type=oneshot
User=dash
Group=dash
EnvironmentFile=/srv/dash-commerce/.env
# --fail so a non-2xx is a unit failure and shows up in systemctl/journalctl
# rather than passing silently. --max-time is above the endpoint's own budget.
ExecStart=/usr/bin/curl --fail --silent --show-error --max-time 120 \
  -X POST http://127.0.0.1:3000/api/cron/campaigns \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

`/etc/systemd/system/dash-campaigns.timer`:

```ini
[Unit]
Description=Run the StoreIM campaign scheduler every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
# Ticks that pile up while the server was down collapse into one.
Persistent=false
AccuracySec=10s

[Install]
WantedBy=timers.target
```

```bash
systemctl daemon-reload
systemctl enable --now dash-campaigns.timer
systemctl list-timers dash-campaigns.timer
journalctl -u dash-campaigns -f
```

### plain cron

```cron
* * * * * curl --fail --silent --max-time 120 -X POST http://127.0.0.1:3000/api/cron/campaigns -H "Authorization: Bearer REPLACE_WITH_CRON_SECRET" >/dev/null
```

Putting the secret in a crontab line means it is readable by anyone who can read
the crontab, and it appears in process listings while curl runs. The systemd unit
above reads it from `.env` instead and is the better option where there is a
choice.

### hosted schedulers

Anything that can make an authenticated HTTP request works. `GET` is accepted as
well as `POST`, because several hosted schedulers can only issue one.

## Notes

- **Overlapping ticks are safe.** Two sweeps that meet on the same campaign claim
  different batches of it. One-message-per-recipient is held by a conditional
  claim in the database, not by arranging for only one scheduler to exist.
- **A paused campaign stays paused.** When a store exhausts its monthly SMS
  allowance mid-send, the campaign pauses with the reason on it, and the
  scheduler leaves it alone. Resuming is a decision with a cost attached, so a
  person makes it.
- **The endpoint is internal.** Reach it on `127.0.0.1`. `deploy/Caddyfile`
  already blocks `/api/domains/authorize` from the outside; add
  `/api/cron/campaigns` to that same block if the app is ever exposed directly.
- **Check it is working:** `journalctl -u dash-campaigns -n 20`, or look for
  `[cron] campaigns:` lines in `journalctl -u dash-web`.
