# 🔐 GitHub Secrets Configuration Guide

Quick reference for setting up GitHub Actions secrets for CI/CD pipeline.

---

## Required Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### VPS Deployment Credentials

| Secret Name | How to Get It | Example Value |
|------------|---------------|---------------|
| `VPS_HOST` | Your VPS IP address or domain | `123.45.67.89` or `myserver.com` |
| `VPS_USER` | SSH username (recommended: `deploy`) | `deploy` |
| `VPS_SSH_KEY` | SSH private key content | `-----BEGIN OPENSSH PRIVATE KEY-----\nxxxxxx...\n-----END OPENSSH PRIVATE KEY-----` |
| `VPS_PORT` | SSH port (optional, defaults to 22) | `22` |
| `GHCR_TOKEN` | GitHub Personal Access Token for VPS to pull images | `ghp_xxxxxxxxxxxxxxxxxxxx` |

**Steps to create GitHub Personal Access Token (for GHCR):**

1. Go to GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token** → **Generate new token (classic)**
3. Set token details:
   - **Note**: `ResourceManager VPS GHCR Access`
   - **Expiration**: Choose appropriate duration (90 days recommended)
   - **Scopes**: Select **read:packages** (allows pulling private images)
4. Click **Generate token**
5. Copy the token immediately (starts with `ghp_`) - you won't see it again!
6. Add to GitHub Secrets as `GHCR_TOKEN`

**VPS Setup for GHCR:**

On your VPS, the deployment will automatically login to GHCR using this token:
```bash
echo $GHCR_TOKEN | docker login ghcr.io -u h-heni --password-stdin
```

---

**Steps to create SSH key:**

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/resourcemanager_deploy
# Press Enter twice (no passphrase for automation)

# Display private key (add to GitHub Secret: VPS_SSH_KEY)
cat ~/.ssh/resourcemanager_deploy

# Display public key
cat ~/.ssh/resourcemanager_deploy.pub
```

**Add public key to VPS:**

```bash
# SSH into VPS
ssh root@your-vps-ip

# Switch to deploy user (or create it)
su - deploy

# Add public key
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
# Paste the public key, save and exit

chmod 600 ~/.ssh/authorized_keys
```

**Test SSH connection:**

```bash
ssh -i ~/.ssh/resourcemanager_deploy deploy@your-vps-ip
```

---

## Optional Variables

Go to **Variables** tab (next to Secrets):

| Variable Name | Default | Description |
|--------------|---------|-------------|
| `DEPLOY_PATH` | `/opt/resourcemanager` | Deployment directory on VPS |
| `VITE_API_URL` | (empty) | Frontend API URL (usually empty for proxy setup) |

---

## Environment Protection Rules

Set up environment protection for production:

1. Go to **Settings** → **Environments**
2. Click **New environment**, name it `production`
3. Add protection rules:
   - ✅ **Required reviewers**: Select team members who must approve
   - ✅ **Wait timer**: Add delay (e.g., 5 minutes) before deployment
   - ✅ **Deployment branches**: Restrict to `main` branch only
4. Click **Save protection rules**

This ensures production deployments require manual approval.

---

## Secrets Summary Checklist

Before running the CI/CD pipeline, verify you have:

- [ ] `VPS_HOST` - VPS IP or domain
- [ ] `VPS_USER` - SSH username (e.g., `deploy`)
- [ ] `VPS_SSH_KEY` - Private SSH key (entire content including headers)
- [ ] `VPS_PORT` - SSH port (if not 22)
- [ ] `GHCR_TOKEN` - GitHub Personal Access Token with `read:packages` scope
- [ ] Production environment created with protection rules

**Note**: `GITHUB_TOKEN` is automatically available in GitHub Actions for pushing images to GHCR.

---

## Testing Secrets

### Test GitHub Container Registry Login

```bash
# On your local machine (or VPS)
echo "YOUR_GHCR_TOKEN" | docker login ghcr.io -u h-heni --password-stdin

# Try pulling an image
docker pull ghcr.io/h-heni/resourcemanager-api:latest
```

### Test SSH Connection

```bash
# On your local machine
ssh -i ~/.ssh/resourcemanager_deploy YOUR_VPS_USER@YOUR_VPS_HOST
```

### Test GitHub Actions

1. Make a small commit to `main` branch
2. Go to **Actions** tab
3. Watch the **CI/CD Pipeline** workflow
4. It should build and push images successfully

---

## Security Best Practices

### ✅ DO

- Use strong, unique passwords (minimum 32 characters)
- Generate JWT_KEY with: `openssl rand -base64 48`
- Use SSH keys instead of passwords
- Restrict environment to specific branches
- Add required reviewers for production
- Rotate secrets periodically (every 90 days)

### ❌ DON'T

- Commit secrets to source control
- Share secrets in plain text (Slack, email, etc.)
- Use the same secrets for staging and production
- Use weak or default passwords
- Give GitHub token more permissions than needed

---

## Rotating Secrets

### GitHub Personal Access Token Rotation

1. Create a new token on GitHub
2. Update `GHCR_TOKEN` secret in GitHub repository settings
3. Update token on VPS (login again with new token)
4. Run a test deployment
5. Delete the old token on GitHub

### SSH Key Rotation

1. Generate new SSH key pair
2. Add new public key to VPS `authorized_keys`
3. Update `VPS_SSH_KEY` secret in GitHub
4. Run a test deployment
5. Remove old public key from VPS

---

## Troubleshooting

### "unauthorized: authentication required" (GHCR)

- **Cause**: Wrong GitHub token or insufficient permissions
- **Fix**: Verify `GHCR_TOKEN` has `read:packages` scope
- **Test**: Login manually with token: `echo $TOKEN | docker login ghcr.io -u h-heni --password-stdin`

### "Permission denied (publickey)" (SSH)

- **Cause**: SSH key not authorized on VPS
- **Fix**: Ensure public key is in `~/.ssh/authorized_keys` on VPS
- **Test**: `ssh -i ~/.ssh/key deploy@vps-ip`

### "Error: Unable to locate credentials" (GitHub)

- **Cause**: Secret name mismatch or secret not created
- **Fix**: Verify secret names match exactly (case-sensitive)
- **Check**: Settings → Secrets and variables → Actions

### Workflow doesn't trigger

- **Cause**: Branch protection or wrong branch
- **Fix**: Ensure you're pushing to `main` or `staging` branch
- **Check**: `.github/workflows/ci.yml` → `on.push.branches`

---

## Getting Help

If you encounter issues:

1. **Check GitHub Actions logs** - Click on failed workflow → View job logs
2. **Verify secrets** - Go to Settings → Secrets and confirm they exist
3. **Test credentials manually** - Use the test commands above
4. **Check VPS logs** - SSH into VPS and run `docker compose logs`

---

## Quick Reference Commands

```bash
# Generate JWT secret
openssl rand -base64 48

# Generate database password
openssl rand -base64 32

# Generate SSH key
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/deploy_key

# Test GHCR login
echo "TOKEN" | docker login ghcr.io -u h-heni --password-stdin

# Test SSH
ssh -i ~/.ssh/deploy_key USER@VPS_IP

# View GitHub Actions logs
gh run list
gh run view RUN_ID --log
```

---

**Next Steps**: After configuring all secrets, proceed to [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions.