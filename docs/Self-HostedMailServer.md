# Self-Hosted Mail Server Setup for rscmanager.com

Complete guide to set up Postfix + Dovecot on your VPS for sending transactional emails from ResourceManager.

---

## Prerequisites

- **VPS with root access** (Ubuntu 22.04/24.04 recommended)
- **Domain**: rscmanager.com pointed to your VPS IP
- **Ports open**: 25, 587, 465, 993, 143
- **SSL certificate** for mail.rscmanager.com

---

## Step 1: SSH Into Your VPS

```bash
ssh root@YOUR_VPS_IP
```

---

## Step 2: Set Hostname & DNS

```bash
# Set hostname
hostnamectl set-hostname mail.rscmanager.com

# Edit /etc/hosts
echo "YOUR_VPS_IP mail.rscmanager.com mail" >> /etc/hosts

# Verify
hostname -f
# Should output: mail.rscmanager.com
```

---

## Step 3: Install Postfix + Dovecot

```bash
# Update system
apt update && apt upgrade -y

# Install mail server packages
apt install -y postfix postfix-policyd-spf-python dovecot-core dovecot-imapd dovecot-lmtpd dovecot-pop3d

# During Postfix installation:
# - Select "Internet Site"
# - System mail name: rscmanager.com
```

---

## Step 4: Configure Postfix (SMTP Server)

```bash
# Backup original config
cp /etc/postfix/main.cf /etc/postfix/main.cf.backup

# Create new config
cat > /etc/postfix/main.cf << 'EOF'
# ═══════════════════════════════════════════════════════════════
# Postfix Configuration for rscmanager.com
# ═══════════════════════════════════════════════════════════════

# Basic settings
smtpd_banner = $myhostname ESMTP
biff = no
append_dot_mydomain = no
readme_directory = no

# TLS parameters (SSL)
smtpd_tls_cert_file = /etc/ssl/rscmanager.com.crt
smtpd_tls_key_file = /etc/ssl/rscmanager.com.key
smtpd_tls_security_level = may
smtpd_tls_loglevel = 1
smtpd_tls_session_cache_database = btree:${data_directory}/smtpd_scache

smtp_tls_CApath = /etc/ssl/certs
smtp_tls_security_level = may
smtp_tls_session_cache_database = btree:${data_directory}/smtp_scache

# Authentication
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = yes
smtpd_sasl_security_options = noanonymous
smtpd_sasl_local_domain = $myhostname

# Restrictions
smtpd_helo_required = yes
smtpd_helo_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_invalid_helo_hostname, reject_non_fqdn_helo_hostname
smtpd_sender_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_non_fqdn_sender, reject_unknown_sender_domain
smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination, reject_non_fqdn_recipient, reject_unknown_recipient_domain

# Network settings
myhostname = mail.rscmanager.com
mydomain = rscmanager.com
myorigin = $mydomain
mydestination = $myhostname, localhost.$mydomain, localhost, $mydomain
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all
inet_protocols = all

# Mailbox
home_mailbox = Maildir/
mailbox_command =

# Virtual aliases (optional)
alias_maps = hash:/etc/aliases
alias_database = hash:/etc/aliases

# Message size limit (25MB)
message_size_limit = 26214400
EOF
```

---

## Step 5: Configure Postfix Submission (Port 587)

```bash
# Edit master.cf to enable submission port
cat >> /etc/postfix/master.cf << 'EOF'

# Submission port (587) for authenticated clients
submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o smtpd_relay_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
EOF
```

---

## Step 6: Configure Dovecot (Authentication)

```bash
# Main Dovecot config
cat > /etc/dovecot/dovecot.conf << 'EOF'
# Dovecot configuration for rscmanager.com

protocols = imap lmtp
listen = *, ::

# Mail location
mail_location = maildir:~/Maildir

# Authentication
disable_plaintext_auth = yes
auth_mechanisms = plain login

# SSL
ssl = required
ssl_cert = </etc/ssl/rscmanager.com.crt
ssl_key = </etc/ssl/rscmanager.com.key
ssl_min_protocol = TLSv1.2
ssl_cipher_list = HIGH:!aNULL:!MD5

# User authentication (system users)
passdb {
  driver = pam
}

userdb {
  driver = passwd
}

# Postfix SASL authentication
service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}

# LMTP for local delivery
service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}

# Logging
log_path = /var/log/dovecot.log
info_log_path = /var/log/dovecot-info.log
EOF
```

---

## Step 7: Create Email User Account

```bash
# Create system user for noreply@rscmanager.com
useradd -m -s /usr/sbin/nologin noreply

# Set password (THIS IS YOUR EMAIL_SMTP_PASSWORD)
passwd noreply
# Enter a strong password, e.g.: Rsc2026!Email#Secure

# Create Maildir
mkdir -p /home/noreply/Maildir
chown -R noreply:noreply /home/noreply/Maildir
chmod -R 700 /home/noreply/Maildir

# Optional: Create support@rscmanager.com
useradd -m -s /usr/sbin/nologin support
passwd support
mkdir -p /home/support/Maildir
chown -R support:support /home/support/Maildir
```

**Important**: The password you set here is your `EMAIL_SMTP_PASSWORD` for the application.

---

## Step 8: SSL Certificate Setup

### Option A: Use Existing Certificate

```bash
# If you already have SSL certs for rscmanager.com, copy them:
cp /path/to/your/certificate.crt /etc/ssl/rscmanager.com.crt
cp /path/to/your/private.key /etc/ssl/rscmanager.com.key
chmod 600 /etc/ssl/rscmanager.com.key
```

### Option B: Generate with Let's Encrypt

```bash
# Install certbot
apt install -y certbot

# Stop nginx temporarily if running
systemctl stop nginx

# Get certificate for mail subdomain
certbot certonly --standalone -d mail.rscmanager.com

# Copy certificates to standard location
cp /etc/letsencrypt/live/mail.rscmanager.com/fullchain.pem /etc/ssl/rscmanager.com.crt
cp /etc/letsencrypt/live/mail.rscmanager.com/privkey.pem /etc/ssl/rscmanager.com.key
chmod 600 /etc/ssl/rscmanager.com.key

# Restart nginx
systemctl start nginx
```

### Option C: Use Same Cert as Main Domain

```bash
# If you have a wildcard cert or cert that covers both domains
ln -s /etc/letsencrypt/live/rscmanager.com/fullchain.pem /etc/ssl/rscmanager.com.crt
ln -s /etc/letsencrypt/live/rscmanager.com/privkey.pem /etc/ssl/rscmanager.com.key
```

---

## Step 9: Configure Firewall

```bash
# Allow mail ports
ufw allow 25/tcp    # SMTP (inbound mail from other servers)
ufw allow 587/tcp   # Submission (your app uses this)
ufw allow 465/tcp   # SMTPS (deprecated but some clients use it)
ufw allow 993/tcp   # IMAPS (if you want to read mail)
ufw allow 143/tcp   # IMAP (unencrypted - not recommended)

# Reload firewall
ufw reload

# Verify
ufw status
```

---

## Step 10: Start Services

```bash
# Restart and enable services
systemctl restart postfix
systemctl restart dovecot
systemctl enable postfix
systemctl enable dovecot

# Check status
systemctl status postfix
systemctl status dovecot

# Both should show "active (running)"
```

---

## Step 11: DNS Records

Add these records to your domain registrar's DNS management:

| Type | Host | Value | TTL | Purpose |
|------|------|-------|-----|---------|
| **A** | `mail` | `YOUR_VPS_IP` | 3600 | Points mail.rscmanager.com to server |
| **MX** | `@` | `mail.rscmanager.com` | 3600 | Directs incoming mail to your server |
| **TXT** | `@` | `v=spf1 ip4:YOUR_VPS_IP -all` | 3600 | SPF - authorizes your IP to send mail |
| **TXT** | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@rscmanager.com` | 3600 | DMARC policy |

### PTR Record (Reverse DNS)

**Important**: Contact your VPS provider to set the PTR record:

```
YOUR_VPS_IP → mail.rscmanager.com
```

This is critical for email deliverability. Most providers have a control panel option or support ticket for this.

### Verify DNS Records

```bash
# Check A record
dig A mail.rscmanager.com +short

# Check MX record
dig MX rscmanager.com +short

# Check SPF record
dig TXT rscmanager.com +short

# Check DMARC record
dig TXT _dmarc.rscmanager.com +short

# Check PTR record
dig -x YOUR_VPS_IP +short
```

---

## Step 12: Test the Mail Server

### Install Test Tool

```bash
apt install -y swaks
```

### Send Test Email

```bash
swaks --to your-personal-email@gmail.com \
      --from noreply@rscmanager.com \
      --server localhost \
      --port 587 \
      --auth LOGIN \
      --auth-user noreply \
      --auth-password 'YOUR_PASSWORD_HERE' \
      --tls \
      --header "Subject: Test from rscmanager.com" \
      --body "Mail server is working!"
```

### Check Logs

```bash
# Watch mail logs in real-time
tail -f /var/log/mail.log

# Check for errors
grep -i error /var/log/mail.log
grep -i warning /var/log/mail.log
```

### Test SMTP Connection

```bash
# Test port 587 is open
telnet mail.rscmanager.com 587

# You should see:
# 220 mail.rscmanager.com ESMTP
```

---

## Step 13: Update Application Configuration

### Production .env File

```bash
# ═══════════════════════════════════════════════════════════════
# EMAIL CONFIGURATION - Self-hosted mail server
# ═══════════════════════════════════════════════════════════════

EMAIL_SMTP_HOST=mail.rscmanager.com
EMAIL_SMTP_PORT=587
EMAIL_USE_TLS=true

EMAIL_SMTP_USER=noreply
EMAIL_SMTP_PASSWORD=Rsc2026!Email#Secure    # The password from Step 7

EMAIL_FROM_ADDRESS=noreply@rscmanager.com
EMAIL_FROM_NAME=RSC Manager
EMAIL_REPLY_TO=support@rscmanager.com
```

### Docker Compose (if using containers)

```yaml
environment:
  - EMAIL_SMTP_HOST=mail.rscmanager.com
  - EMAIL_SMTP_PORT=587
  - EMAIL_SMTP_USER=noreply
  - EMAIL_SMTP_PASSWORD=${EMAIL_SMTP_PASSWORD}
  - EMAIL_FROM_ADDRESS=noreply@rscmanager.com
  - EMAIL_FROM_NAME=RSC Manager
  - EMAIL_USE_TLS=true
```

---

## DKIM Setup (Optional but Recommended)

DKIM adds cryptographic signatures to your emails, improving deliverability.

### Install OpenDKIM

```bash
apt install -y opendkim opendkim-tools
```

### Generate DKIM Keys

```bash
# Create directory
mkdir -p /etc/opendkim/keys/rscmanager.com
cd /etc/opendkim/keys/rscmanager.com

# Generate keys
opendkim-genkey -s default -d rscmanager.com

# Set permissions
chown opendkim:opendkim default.private
chmod 600 default.private

# View public key for DNS
cat default.txt
```

### Configure OpenDKIM

```bash
cat > /etc/opendkim.conf << 'EOF'
Syslog                  yes
SyslogSuccess           yes
LogWhy                  yes

Canonicalization        relaxed/simple
Mode                    sv
SubDomains              no

AutoRestart             yes
AutoRestartRate         10/1M
Background              yes
DNSTimeout              5
SignatureAlgorithm      rsa-sha256

Domain                  rscmanager.com
Selector                default
KeyFile                 /etc/opendkim/keys/rscmanager.com/default.private

Socket                  local:/var/spool/postfix/opendkim/opendkim.sock

PidFile                 /run/opendkim/opendkim.pid
TrustAnchorFile         /usr/share/dns/root.key
UserID                  opendkim
EOF
```

### Integrate with Postfix

```bash
# Add to /etc/postfix/main.cf
cat >> /etc/postfix/main.cf << 'EOF'

# OpenDKIM
milter_default_action = accept
milter_protocol = 6
smtpd_milters = local:/opendkim/opendkim.sock
non_smtpd_milters = $smtpd_milters
EOF

# Create socket directory
mkdir -p /var/spool/postfix/opendkim
chown opendkim:postfix /var/spool/postfix/opendkim

# Restart services
systemctl restart opendkim
systemctl restart postfix
```

### Add DKIM DNS Record

Add a TXT record with the content from `/etc/opendkim/keys/rscmanager.com/default.txt`:

| Type | Host | Value |
|------|------|-------|
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBg...` (your public key) |

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Connection refused on port 587 | Firewall blocking | `ufw allow 587/tcp` |
| Authentication failed | Wrong password | `doveadm auth test noreply YOUR_PASSWORD` |
| Certificate error | Wrong path or permissions | Check paths in configs, `chmod 600` on key |
| Emails go to spam | Missing SPF/DKIM/DMARC | Add DNS records, request PTR from VPS provider |
| "Relay access denied" | Not authenticated | Ensure SASL is configured correctly |
| Timeout errors | DNS not resolving | Check `/etc/resolv.conf`, try `8.8.8.8` |

### Useful Commands

```bash
# Test authentication
doveadm auth test noreply YOUR_PASSWORD

# Check Postfix queue
postqueue -p

# Flush mail queue
postqueue -f

# View mail logs
journalctl -u postfix -f
journalctl -u dovecot -f

# Check listening ports
ss -tlnp | grep -E '25|587|993'

# Test DNS
dig MX rscmanager.com +short
dig TXT rscmanager.com +short
```

### Email Deliverability Testing

1. **Mail-Tester.com**: Send email to their test address, get score (aim for 10/10)
2. **MXToolbox**: https://mxtoolbox.com/emailhealth - comprehensive DNS check
3. **Google Postmaster Tools**: Monitor reputation if sending to Gmail

---

## Security Hardening

### Fail2Ban (Protect Against Brute Force)

```bash
apt install -y fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[postfix]
enabled = true
port = smtp,465,submission
filter = postfix
logpath = /var/log/mail.log
maxretry = 5

[dovecot]
enabled = true
port = pop3,pop3s,imap,imaps,submission,465,sieve
filter = dovecot
logpath = /var/log/dovecot.log
maxretry = 5
EOF

systemctl restart fail2ban
```

### Rate Limiting in Postfix

```bash
# Add to /etc/postfix/main.cf
smtpd_client_message_rate_limit = 100
smtpd_client_recipient_rate_limit = 100
anvil_rate_time_unit = 60s
```

---

## Maintenance

### Certificate Renewal (Let's Encrypt)

```bash
# Add to crontab
crontab -e

# Add this line (renews at 3am on the 1st of each month)
0 3 1 * * certbot renew --quiet --post-hook "systemctl reload postfix dovecot"
```

### Log Rotation

Logs are automatically rotated by logrotate. Check `/etc/logrotate.d/postfix` and `/etc/logrotate.d/dovecot`.

### Backup

```bash
# Backup mail configuration
tar -czf /backup/mail-config-$(date +%Y%m%d).tar.gz \
    /etc/postfix \
    /etc/dovecot \
    /etc/opendkim \
    /etc/ssl/rscmanager.com.*
```

---

## Quick Reference

### Final Credentials

```
SMTP Server: mail.rscmanager.com
Port: 587 (STARTTLS)
Username: noreply
Password: [password set in Step 7]
From Address: noreply@rscmanager.com
```

### Service Commands

```bash
systemctl start postfix     # Start
systemctl stop postfix      # Stop
systemctl restart postfix   # Restart
systemctl status postfix    # Check status

# Same for dovecot
systemctl restart dovecot
```

### Files to Know

| File | Purpose |
|------|---------|
| `/etc/postfix/main.cf` | Postfix main config |
| `/etc/postfix/master.cf` | Postfix services config |
| `/etc/dovecot/dovecot.conf` | Dovecot config |
| `/var/log/mail.log` | Mail server logs |
| `/etc/ssl/rscmanager.com.crt` | SSL certificate |
| `/etc/ssl/rscmanager.com.key` | SSL private key |
