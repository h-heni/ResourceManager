# 🔐 PostgreSQL Backup Solution

Fully automated backup solution for PostgreSQL running in Docker on Ubuntu VPS.

---

## 🎯 Quick Start (3 Steps)

```bash
# 1. Make scripts executable
chmod +x scripts/*.sh

# 2. Setup automated daily backups (2 AM)
sudo scripts/setup-backup-cron.sh

# 3. Test it works
scripts/pg-backup.sh
```

✅ **Done!** Your database will now backup automatically every day at 2 AM.

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **[BACKUP_GUIDE.md](BACKUP_GUIDE.md)** | 📖 Complete guide with setup, restore, troubleshooting |
| **[BACKUP_QUICKREF.md](BACKUP_QUICKREF.md)** | ⚡ Quick reference card for common commands |
| **[BACKUP_SYSTEMD.md](BACKUP_SYSTEMD.md)** | �� Systemd timer alternative to cron |
| **[scripts/README.md](scripts/README.md)** | 🛠️ Script documentation and usage |

---

## 📦 What's Included

### Scripts

- **`scripts/pg-backup.sh`** - Main backup script
  - Dumps database from Docker container
  - Compresses with gzip (80%+ reduction)
  - Automatic rotation (default: keep 7 backups)
  - Optional external storage
  - Integrity verification

- **`scripts/pg-restore.sh`** - Restore script
  - List available backups
  - Interactive restore with confirmation
  - Safety backup before restore
  - Verification after restore

- **`scripts/setup-backup-cron.sh`** - Cron automation
  - One-command setup
  - Configurable schedule
  - Configurable retention
  - Easy removal

### Backups Storage

- Location: `backups/`
- Format: `backup_resourcemanager_YYYYMMDD_HHMMSS.sql.gz`
- Automatic rotation keeps only recent backups
- Excluded from git (in `.gitignore`)

---

## 💡 Common Use Cases

### Daily Backup (Default)
```bash
sudo scripts/setup-backup-cron.sh
```

### Every 6 Hours
```bash
sudo scripts/setup-backup-cron.sh --schedule "0 */6 * * *"
```

### With External Storage
```bash
sudo scripts/setup-backup-cron.sh --external /mnt/backup --retention 14
```

### Manual Backup
```bash
scripts/pg-backup.sh
```

### List Backups
```bash
scripts/pg-restore.sh --list-backups
```

### Restore Database
```bash
scripts/pg-restore.sh backups/backup_resourcemanager_20260212_120000.sql.gz
```

---

## 🔍 Monitoring

### Check Backup Logs
```bash
tail -f backups/backup.log
```

### View Cron Jobs
```bash
crontab -l
```

### Check Last Backup
```bash
ls -lh backups/ | tail -5
```

### Verify Cron is Running
```bash
systemctl status cron
```

---

## ✅ Features

- ✅ **Automated daily backups** via cron
- ✅ **Compressed backups** (gzip)
- ✅ **Automatic rotation** (keeps last 7 by default)
- ✅ **External storage** support (NFS, USB, cloud)
- ✅ **Works with Docker** container
- ✅ **Easy restore** with safety features
- ✅ **Integrity verification**
- ✅ **Detailed logging**
- ✅ **Comprehensive documentation**

---

## 🆘 Troubleshooting

### Container not running?
```bash
docker compose up -d postgres_db
```

### Permission denied?
```bash
chmod +x scripts/*.sh
```

### Cron not working?
```bash
sudo systemctl start cron
crontab -l
```

### Check logs
```bash
tail -f backups/backup.log
```

**For more troubleshooting, see [BACKUP_GUIDE.md](BACKUP_GUIDE.md#troubleshooting)**

---

## 📋 Requirements

- Docker & Docker Compose
- PostgreSQL container running (name: `postgres_db`)
- `.env` file with database credentials
- `gzip` (compression)
- `bc` (calculations)

Install missing dependencies:
```bash
sudo apt-get install -y bc gzip
```

---

## 🔐 Security Best Practices

1. **Test restores regularly** - Backups are useless if they can't be restored
2. **Use external storage** - Don't rely on a single disk
3. **Encrypt backups** - For sensitive data
4. **Monitor regularly** - Check logs and backup sizes
5. **Restrict permissions** - `chmod 700 backups/`

See [BACKUP_GUIDE.md](BACKUP_GUIDE.md#security-considerations) for details.

---

## 📞 Need Help?

1. Check [BACKUP_GUIDE.md](BACKUP_GUIDE.md) for detailed documentation
2. Check [BACKUP_QUICKREF.md](BACKUP_QUICKREF.md) for quick commands
3. Review `backups/backup.log` for errors
4. Verify Docker is running: `docker ps`
5. Test database connection: `docker exec postgres_db pg_isready`

---

## 🎉 That's It!

Your database is now protected with automated backups. Remember to:
- ✅ Test restore at least once
- ✅ Monitor logs regularly
- ✅ Ensure external storage is working (if configured)

**Happy backing up!** 🚀

---

*Part of the ResourceManager project - See [SETUP_GUIDE.md](SETUP_GUIDE.md) for full setup instructions.*
