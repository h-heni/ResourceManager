# DNS Configuration for rscmanager.com - Email Deliverability

This document provides the exact DNS TXT records required to ensure emails from `rscmanager.com` reach recipients' inboxes instead of spam folders.

## Prerequisites

Before configuring DNS records, you need:
1. Access to your domain registrar's DNS management panel
2. Your VPS public IP address (replace `YOUR_VPS_IP` below with actual IP)
3. SMTP server hostname (e.g., `mail.rscmanager.com` or your SMTP provider's server)

---

## 1. SPF (Sender Policy Framework) Record

SPF specifies which mail servers are authorized to send email for your domain.

### DNS Record Type: `TXT`
### Host/Name: `@` (or `rscmanager.com`)
### Value:

```
v=spf1 ip4:YOUR_VPS_IP -all
```

### Explanation:
- `v=spf1` - SPF version 1
- `ip4:YOUR_VPS_IP` - Authorizes your VPS IP to send emails
- `-all` - Hard fail for unauthorized senders (recommended for security)

### Examples for different scenarios:

**Using your own VPS only (recommended):**
```
v=spf1 ip4:YOUR_VPS_IP -all
```

**Using your VPS + additional mail server:**
```
v=spf1 ip4:YOUR_VPS_IP ip4:SECONDARY_IP ~all
```

**Using your VPS + Sendgrid:**
```
v=spf1 ip4:YOUR_VPS_IP include:sendgrid.net ~all
```

**Using your VPS + Mailgun:**
```
v=spf1 ip4:YOUR_VPS_IP include:mailgun.org ~all
```

---

## 2. DKIM (DomainKeys Identified Mail) Record

DKIM adds a digital signature to outgoing emails, proving they haven't been tampered with.

### Step 1: Generate DKIM Keys

Run this on your mail server or VPS:
```bash
# Generate 2048-bit RSA key pair
openssl genrsa -out dkim.private.key 2048
openssl rsa -in dkim.private.key -pubout -out dkim.public.key

# Extract the public key content (remove headers/footers)
cat dkim.public.key | grep -v "^-" | tr -d '\n'
```

### Step 2: Add DNS Record

#### DNS Record Type: `TXT`
#### Host/Name: `default._domainkey` (or `rscmanager._domainkey`)
#### Value:

```
v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE
```

### Example (replace with your actual public key):
```
v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuF7J2HJj3F8YK5mQ9EXAMPLE...
```

### Note:
You must generate and configure DKIM keys on your mail server. Most mail servers (Postfix, Exim, OpenSMTPD) have built-in DKIM support or can use OpenDKIM.

---

## 3. DMARC (Domain-based Message Authentication, Reporting & Conformance)

DMARC tells receiving mail servers what to do with emails that fail SPF/DKIM checks.

### DNS Record Type: `TXT`
### Host/Name: `_dmarc`
### Value (Start with monitoring mode):

```
v=DMARC1; p=none; rua=mailto:dmarc-reports@rscmanager.com; ruf=mailto:dmarc-reports@rscmanager.com; fo=1
```

### Explanation:
- `v=DMARC1` - DMARC version 1
- `p=none` - Policy: monitor only (change to `quarantine` or `reject` after testing)
- `rua=mailto:...` - Aggregate reports sent here
- `ruf=mailto:...` - Forensic/failure reports sent here
- `fo=1` - Generate failure reports for any authentication failure

### Progressive DMARC Policies:

**Phase 1 - Monitoring (Start here):**
```
v=DMARC1; p=none; rua=mailto:dmarc-reports@rscmanager.com
```

**Phase 2 - Quarantine (After 2-4 weeks of monitoring):**
```
v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc-reports@rscmanager.com
```

**Phase 3 - Enforce (After confirming legitimate emails pass):**
```
v=DMARC1; p=reject; rua=mailto:dmarc-reports@rscmanager.com
```

---

## 4. PTR (Reverse DNS) Record

PTR records map IP addresses back to domain names. This is configured through your VPS provider, not your domain registrar.

### Contact your VPS provider to set:
```
YOUR_VPS_IP → mail.rscmanager.com
```

Or use the CLI if available:
```bash
# Check current PTR record
dig -x YOUR_VPS_IP
```

---

## 5. MX Record (if receiving email)

If you want to receive email at `@rscmanager.com`:

### DNS Record Type: `MX`
### Host/Name: `@`
### Value: `mail.rscmanager.com` (Priority: 10)

---

## Complete DNS Configuration Summary

| Record Type | Host/Name | Value | TTL |
|-------------|-----------|-------|-----|
| A | mail | YOUR_VPS_IP | 3600 |
| TXT | @ | `v=spf1 ip4:YOUR_VPS_IP -all` | 3600 |
| TXT | default._domainkey | `v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY` | 3600 |
| TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:dmarc-reports@rscmanager.com` | 3600 |
| MX | @ | mail.rscmanager.com (Priority: 10) | 3600 |

---

## Verification Commands

After configuring DNS records, verify them:

```bash
# Check SPF record
dig TXT rscmanager.com +short

# Check DKIM record
dig TXT default._domainkey.rscmanager.com +short

# Check DMARC record
dig TXT _dmarc.rscmanager.com +short

# Check MX record
dig MX rscmanager.com +short

# Full email deliverability test
# Use: https://www.mail-tester.com/ (send an email to their test address)
```

---

## Testing Email Deliverability

1. **Mail-Tester.com**: Send a test email and get a score (aim for 10/10)
2. **SMTP Health Check API**: `GET /api/health/smtp` 
3. **MXToolbox**: Comprehensive DNS and email testing
4. **Postmaster Tools**: Monitor email reputation (various providers)

---

## Environment Variables Required

Set these in your deployment environment:

```bash
# Required SMTP Configuration (Your domain's mail server)
EMAIL_SMTP_HOST=mail.rscmanager.com   # Your mail server hostname
EMAIL_SMTP_PORT=587                    # STARTTLS port
EMAIL_SMTP_USER=noreply@rscmanager.com
EMAIL_SMTP_PASSWORD=your-smtp-password # Your mail server password
EMAIL_FROM_ADDRESS=noreply@rscmanager.com
EMAIL_FROM_NAME=Resource Manager
EMAIL_USE_TLS=true
APP_BASE_URL=https://rscmanager.com
```

---

## Troubleshooting

### Emails going to spam?

1. **Check SPF alignment**: The "From" domain must match SPF authorized domain
2. **Check DKIM signature**: Ensure DKIM is properly configured and signing emails
3. **Review DMARC reports**: Look for authentication failures
4. **Check IP reputation**: Use `https://www.spamhaus.org/lookup/` to verify your IP isn't blacklisted
5. **Warm up your domain**: Start with low volume, gradually increase

### Common Issues:

| Issue | Solution |
|-------|----------|
| SPF PermError | Check for syntax errors, max 10 DNS lookups |
| DKIM fail | Verify public key format, check selector name |
| DMARC fail | Both SPF AND DKIM must pass for DMARC to pass |
| Blacklisted IP | Contact blacklist provider to request removal |

---

## Security Recommendations

1. **Use dedicated sending IP** if sending high volume
2. **Implement rate limiting** to prevent abuse
3. **Monitor bounce rates** and remove invalid addresses
4. **Use TLS encryption** for all SMTP connections
5. **Rotate DKIM keys** annually
6. **Move to DMARC p=reject** once confident in authentication

---

*Last updated: February 2026*
*Domain: rscmanager.com*
