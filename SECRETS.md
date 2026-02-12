# 🔐 GitHub Secrets Configuration Guide

Quick reference for setting up GitHub Actions secrets for CI/CD pipeline.

---

## Required Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### Docker Hub Credentials

| Secret Name | How to Get It | Example Value |
|------------|---------------|---------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username | `johndoe` |
| `DOCKERHUB_TOKEN` | Docker Hub → Account Settings → Security → Access Tokens → New Token | `dckr_pat_xxxxx...` |

**Steps to create Docker Hub token:**
1. Go to [hub.docker.com](https://hub.docker.com)
2. Click your profile → **Account Settings**
3. Go to **Security** → **Access Tokens**
4. Click **New Access Token**
   - Description: `GitHub Actions ResourceManager`
   - Permissions: **Read & Write** (or Read, Write, Delete)
5. Click **Generate** and copy the token immediately (you won't see it again!)

---

### VPS Deployment Credentials

| Secret Name | How to Get It | Example Value |
|------------|---------------|---------------|
| `VPS_HOST` | Your VPS IP address or domain | `123.45.67.89` or `myserver.com` |
| `VPS_USER` | SSH username (recommended: `deploy`) | `deploy` |
| `VPS_SSH_KEY` | SSH private key content | `-----BEGIN OPENSSH PRIVATE KEY-----\nxxxxxx...\n-----END OPENSSH PRIVATE KEY-----` |
| `VPS_PORT` | SSH port (optional, defaults to 22) | `22` |

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

- [ ] `DOCKERHUB_USERNAME` - Your Docker Hub username
- [ ] `DOCKERHUB_TOKEN` - Docker Hub access token (Read & Write)
- [ ] `VPS_HOST` - VPS IP or domain
- [ ] `VPS_USER` - SSH username (e.g., `deploy`)
- [ ] `VPS_SSH_KEY` - Private SSH key (entire content including headers)
- [ ] `VPS_PORT` - SSH port (if not 22)
- [ ] Production environment created with protection rules

---

## Testing Secrets

### Test Docker Hub Login

```bash
# On your local machine
echo "YOUR_DOCKERHUB_TOKEN" | docker login docker.io -u YOUR_DOCKERHUB_USERNAME --password-stdin
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
- Enable 2FA on Docker Hub
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

### Docker Hub Token Rotation

1. Create a new token on Docker Hub
2. Update `DOCKERHUB_TOKEN` secret in GitHub
3. Run a test deployment
4. Delete the old token on Docker Hub

### SSH Key Rotation

1. Generate new SSH key pair
2. Add new public key to VPS `authorized_keys`
3. Update `VPS_SSH_KEY` secret in GitHub
4. Run a test deployment
5. Remove old public key from VPS

---

## Troubleshooting

### "unauthorized: authentication required" (Docker Hub)

- **Cause**: Wrong Docker Hub credentials
- **Fix**: Verify `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are correct
- **Test**: Login manually with token: `echo $TOKEN | docker login -u $USERNAME --password-stdin`

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

# Test Docker Hub login
echo "TOKEN" | docker login docker.io -u USERNAME --password-stdin

# Test SSH
ssh -i ~/.ssh/deploy_key USER@VPS_IP

# View GitHub Actions logs
gh run list
gh run view RUN_ID --log
```

---

**Next Steps**: After configuring all secrets, proceed to [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions.
