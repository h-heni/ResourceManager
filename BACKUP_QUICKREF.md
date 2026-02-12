# PostgreSQL Backup Quick Reference

## 🚀 One-Time Setup

```bash
# 1. Make scripts executable
chmod +x scripts/*.sh

# 2. Setup daily backups at 2 AM
sudo scripts/setup-backup-cron.sh

# 3. Test backup manually
scripts/pg-backup.sh
```

---

## 📦 Common Commands

### Backup
```bash
# Manual backup
scripts/pg-backup.sh

# With external storage
scripts/pg-backup.sh --external-path /mnt/backup

# Keep 14 days instead of 7
scripts/pg-backup.sh --retention-days 14
```

### Restore
```bash
# List available backups
scripts/pg-restore.sh --list-backups

# Restore (with confirmation)
scripts/pg-restore.sh backups/backup_resourcemanager_20260212_120000.sql.gz

# Restore (no confirmation - for scripts)
scripts/pg-restore.sh backups/backup_*.sql.gz --no-confirm
```

### Cron Management
```bash
# View cron jobs
crontab -l

# Edit cron manually
crontab -e

# Remove backup cron
sudo scripts/setup-backup-cron.sh --remove

# Setup custom schedule (every 6 hours)
sudo scripts/setup-backup-cron.sh --schedule "0 */6 * * *"
```

---

## 🔍 Monitoring

```bash
# Check backup logs
tail -f backups/backup.log

# List backups with sizes
ls -lh backups/

# Check disk space
df -h

# Verify cron is running
systemctl status cron

# Check last cron run
grep CRON /var/log/syslog | tail -20
```

---

## 🆘 Quick Troubleshooting

### Container not running?
```bash
docker ps
docker compose up -d postgres_db
```

### Permission denied?
```bash
chmod +x scripts/*.sh
```

### Cron not working?
```bash
sudo systemctl start cron
sudo systemctl enable cron
```

### Disk full?
```bash
# List backup sizes
du -sh backups/*

# Delete old backups manually
rm backups/backup_resourcemanager_20260101_*.sql.gz

# Reduce retention
sudo scripts/setup-backup-cron.sh --retention 3
```

---

## 📊 Cron Schedule Quick Reference

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

**Examples:**
- `0 2 * * *` - Daily at 2 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly (Sunday midnight)
- `30 1 * * *` - Daily at 1:30 AM

---

## 📚 Full Documentation

See **[BACKUP_GUIDE.md](BACKUP_GUIDE.md)** for:
- Complete setup instructions
- External storage configuration
- Security best practices
- Advanced usage
- Detailed troubleshooting

---

## ✅ Backup Checklist

- [ ] Scripts are executable (`chmod +x scripts/*.sh`)
- [ ] Cron job installed (`crontab -l`)
- [ ] Test backup completed successfully
- [ ] Test restore completed successfully
- [ ] External storage configured (optional)
- [ ] Monitoring setup (check logs regularly)
- [ ] Tested restore at least once

---

**Remember:** A backup is only as good as your ability to restore from it. Test your restore process regularly! 🔐
