# Self-hosting Car Market

Runs the built app and the SEO routes (listing/make/model pages, sitemap, robots) on one
Linux machine: a small Node server behind Caddy, which handles HTTPS automatically.

```
internet ──► DuckDNS name ──► your public IP ──► :80/:443 ──► Caddy ──► Node :8787 ──► dist/
```

## Before you start

1. **Point the DuckDNS name at the right machine.** `car-market.duckdns.org` must resolve to the
   public IP of the machine running Caddy. If that machine is behind a home router, forward TCP
   80 and 443 to it, and make sure the router's own admin page is *not* answering on those ports
   from the internet. If it is a cloud VM (for example Oracle), set the DuckDNS IP to the VM's
   public IP and open 80/443 in the cloud firewall (security list / NSG) and in the OS firewall.
2. If the IP can change, run DuckDNS's updater (cron job from duckdns.org → install) on that machine.
3. Add `https://car-market.duckdns.org/**` to Supabase → Authentication → URL Configuration.

## Install (Debian/Ubuntu)

```bash
# Node 20+ and Caddy
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs git
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy

# App
sudo useradd --system --home /opt/car-market --shell /usr/sbin/nologin carmarket
sudo git clone https://github.com/kalusartem/Car-Market.git /opt/car-market
sudo chown -R "$USER": /opt/car-market
sudo cp /opt/car-market/deploy/car-market.env.example /etc/car-market.env
sudo chmod 600 /etc/car-market.env && sudo nano /etc/car-market.env   # fill in the two Supabase values
sudo cp /opt/car-market/deploy/car-market.service /etc/systemd/system/
sudo cp /opt/car-market/deploy/Caddyfile /etc/caddy/Caddyfile

cd /opt/car-market && ./deploy/deploy.sh
sudo systemctl enable --now car-market
sudo systemctl reload caddy
```

Check: `curl -I https://car-market.duckdns.org/` should return 200 with a valid certificate, and
`curl https://car-market.duckdns.org/robots.txt` should list the sitemap on that hostname.

## Update

```bash
cd /opt/car-market && ./deploy/deploy.sh
```

## Notes

- Caddy needs ports 80 and 443 open to get and renew the Let's Encrypt certificate.
- The Node server only listens on 127.0.0.1; only Caddy is exposed.
- `/healthz` returns `ok` for uptime monitors.
- Everything else (database, auth, image storage) stays on Supabase.
