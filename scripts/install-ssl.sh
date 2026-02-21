#!/bin/bash
set -e

echo "=== Downloading Sectigo intermediate CA certificates ==="

# Download Sectigo DV R36 intermediate cert (HTTP - HTTPS has TLS issues with their CDN)
curl --max-time 15 -sL -o /tmp/sectigo_dv_r36.crt \
  "http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt"

# Download USERTrust RSA root CA (cross-signed)
curl --max-time 15 -sL -o /tmp/usertrust_rsa.crt \
  "http://crt.sectigo.com/USERTrustRSAAAACA.crt"

echo "=== Converting DER to PEM if needed ==="

# Convert DER to PEM (Sectigo often serves DER format)
openssl x509 -inform DER -in /tmp/sectigo_dv_r36.crt -out /tmp/intermediate.pem 2>/dev/null || \
  cp /tmp/sectigo_dv_r36.crt /tmp/intermediate.pem

openssl x509 -inform DER -in /tmp/usertrust_rsa.crt -out /tmp/usertrust.pem 2>/dev/null || \
  cp /tmp/usertrust_rsa.crt /tmp/usertrust.pem

echo "=== Building fullchain ==="

# Build fullchain: server cert + intermediate + root
cat /tmp/rscmanager.com.cer /tmp/intermediate.pem /tmp/usertrust.pem > /tmp/fullchain.pem

echo "=== Verifying certificate chain ==="
openssl verify -untrusted /tmp/intermediate.pem -untrusted /tmp/usertrust.pem /tmp/rscmanager.com.cer || echo "Warning: verification issue (may still work)"

echo "=== Installing SSL files ==="

# Move files to SSL directory
sudo mkdir -p /etc/ssl/rscmanager
sudo cp /tmp/fullchain.pem /etc/ssl/rscmanager/fullchain.pem
sudo cp /tmp/rscmanager.com.key /etc/ssl/rscmanager/privkey.pem
sudo cp /tmp/intermediate.pem /etc/ssl/rscmanager/chain.pem
sudo cp /tmp/rscmanager.com.cer /etc/ssl/rscmanager/cert.pem

# Secure permissions
sudo chmod 600 /etc/ssl/rscmanager/privkey.pem
sudo chmod 644 /etc/ssl/rscmanager/fullchain.pem /etc/ssl/rscmanager/chain.pem /etc/ssl/rscmanager/cert.pem
sudo chown root:root /etc/ssl/rscmanager/*

echo "=== SSL files installed ==="
ls -la /etc/ssl/rscmanager/

echo "=== Updating nginx config ==="

# Update nginx config to use custom SSL paths instead of Let's Encrypt
NGINX_CONF="/etc/nginx/sites-available/rscmanager.conf"

if [ -f "$NGINX_CONF" ]; then
  # Replace Let's Encrypt cert paths with custom SSL paths
  sudo sed -i 's|/etc/letsencrypt/live/rscmanager.com/fullchain.pem|/etc/ssl/rscmanager/fullchain.pem|g' "$NGINX_CONF"
  sudo sed -i 's|/etc/letsencrypt/live/rscmanager.com/privkey.pem|/etc/ssl/rscmanager/privkey.pem|g' "$NGINX_CONF"
  sudo sed -i 's|/etc/letsencrypt/live/rscmanager.com/chain.pem|/etc/ssl/rscmanager/chain.pem|g' "$NGINX_CONF"
  echo "Nginx config updated with custom SSL paths"
else
  echo "ERROR: $NGINX_CONF not found!"
  exit 1
fi

echo "=== Testing nginx config ==="
sudo nginx -t

echo "=== Reloading nginx ==="
sudo systemctl reload nginx

echo ""
echo "========================================="
echo "  SSL INSTALLATION COMPLETE!"
echo "  Certificate: /etc/ssl/rscmanager/fullchain.pem"
echo "  Private Key: /etc/ssl/rscmanager/privkey.pem"
echo "  Chain:       /etc/ssl/rscmanager/chain.pem"
echo "========================================="
