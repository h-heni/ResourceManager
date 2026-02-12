# PostgreSQL Backup Guide

Complete guide for backing up and restoring your PostgreSQL database running in Docker.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Setup Instructions](#setup-instructions)
3. [Manual Backup](#manual-backup)
4. [Restore Instructions](#restore-instructions)
5. [External Storage](#external-storage)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Usage](#advanced-usage)

---

## 🚀 Quick Start

### One-Time Setup (5 minutes)

```bash
# 1. Make scripts executable
chmod +x scripts/*.sh

# 2. Setup automated daily backups (runs at 2 AM)
sudo scripts/setup-backup-cron.sh

# 3. Test the backup
scripts/pg-backup.sh
```

✅ Done! Your database will now backup automatically every day at 2 AM.

---

## 📦 Setup Instructions

### Prerequisites

Ensure these are installed on your Ubuntu VPS:
- Docker & Docker Compose
- `gzip` (usually pre-installed)
- `bc` calculator (for size calculations)

```bash
# Install missing dependencies
sudo apt-get update
sudo apt-get install -y bc gzip
```

### Step 1: Make Scripts Executable

```bash
cd /path/to/ResourceManager
chmod +x scripts/pg-backup.sh
chmod +x scripts/pg-restore.sh
chmod +x scripts/setup-backup-cron.sh
```

### Step 2: Configure Cron Job

**Basic setup (2 AM daily):**
```bash
sudo scripts/setup-backup-cron.sh
```

**Custom schedule:**
```bash
# Every 6 hours
sudo scripts/setup-backup-cron.sh --schedule "0 */6 * * *"

# Every Sunday at 3 AM
sudo scripts/setup-backup-cron.sh --schedule "0 3 * * 0"

# Every day at 1:30 AM
sudo scripts/setup-backup-cron.sh --schedule "30 1 * * *"
```

**With external storage:**
```bash
sudo scripts/setup-backup-cron.sh \
  --external /mnt/backup \
  --retention 14
```

### Step 3: Verify Cron Setup

```bash
# Check cron is running
systemctl status cron

# View installed cron jobs
crontab -l

# Watch backup logs in real-time
tail -f backups/backup.log
```

---

## 💾 Manual Backup

### Basic Backup

```bash
# Run backup manually
scripts/pg-backup.sh
```

This creates a compressed backup in `backups/`:
```
backups/backup_resourcemanager_20260212_143022.sql.gz
```

### Backup with External Storage

```bash
# Copy to external storage (USB drive, NFS mount, etc.)
scripts/pg-backup.sh --external-path /mnt/backup
```

### Custom Retention Period

```bash
# Keep last 14 backups instead of 7
scripts/pg-backup.sh --retention-days 14
```

### Backup Output Example

```
[2026-02-12 14:30:22] [INFO] === PostgreSQL Backup Started ===
[2026-02-12 14:30:22] [INFO] Starting backup of database: resourcemanager
[2026-02-12 14:30:22] [INFO] Container: postgres_db
[2026-02-12 14:30:23] [INFO] Database dump completed
[2026-02-12 14:30:23] [INFO] Uncompressed size: 45.23 MB
[2026-02-12 14:30:23] [INFO] Compressing backup...
[2026-02-12 14:30:25] [INFO] Compression completed
[2026-02-12 14:30:25] [INFO] Compressed size: 8.47 MB (81.3% reduction)
[2026-02-12 14:30:25] [INFO] Backup file integrity verified
[2026-02-12 14:30:25] [INFO] Current backup count: 5
[2026-02-12 14:30:25] [INFO] No old backups to delete
[2026-02-12 14:30:25] [INFO] === Backup Completed Successfully ===
```

---

## 🔄 Restore Instructions

### List Available Backups

```bash
scripts/pg-restore.sh --list-backups
```

Output:
```
Available backups in /home/runner/ResourceManager/backups:
================================================================
backup_resourcemanager_20260212_143022.sql.gz          8.47 MB  2026-02-12 14:30:25
backup_resourcemanager_20260211_020000.sql.gz          8.42 MB  2026-02-11 02:00:15
backup_resourcemanager_20260210_020000.sql.gz          8.38 MB  2026-02-10 02:00:12
================================================================
Total: 3 backup(s)
```

### Restore from Backup

**⚠️ WARNING: This will REPLACE your current database!**

```bash
# Interactive restore (with confirmation prompt)
scripts/pg-restore.sh backups/backup_resourcemanager_20260212_143022.sql.gz
```

The script will:
1. ✅ Create a safety backup of your current database
2. ⚠️ Ask for confirmation
3. 🔄 Restore the backup
4. ✔️ Verify the restoration

### Automated Restore (No Confirmation)

```bash
# For scripts/automation - skips confirmation prompt
scripts/pg-restore.sh backups/backup_resourcemanager_20260212_143022.sql.gz --no-confirm
```

### Restore Output Example

```
[INFO] === PostgreSQL Restore Started ===
[WARN] Creating safety backup of current database before restore...
[INFO] Safety backup created: backups/pre-restore_resourcemanager_20260212_144523.sql.gz

⚠️  WARNING: This will REPLACE the current database!
Database: resourcemanager
Backup file: backups/backup_resourcemanager_20260212_143022.sql.gz

Are you sure you want to continue? (yes/no): yes

[INFO] Starting restore from: backups/backup_resourcemanager_20260212_143022.sql.gz
[INFO] Target database: resourcemanager
[INFO] Container: postgres_db
[INFO] Decompressing and restoring...
[INFO] Restore completed successfully
[INFO] Verifying database connection...
[INFO] Database connection verified
[INFO] Tables in database: 23
[INFO] === Restore Completed Successfully ===
```

---

## ☁️ External Storage

### Option 1: Network File System (NFS)

```bash
# Mount NFS share
sudo mount -t nfs 192.168.1.100:/backups /mnt/backup

# Setup cron with external storage
sudo scripts/setup-backup-cron.sh --external /mnt/backup

# Make mount permanent (add to /etc/fstab)
echo "192.168.1.100:/backups /mnt/backup nfs defaults 0 0" | sudo tee -a /etc/fstab
```

### Option 2: USB/External Drive

```bash
# Find USB device
lsblk

# Mount USB drive
sudo mkdir -p /mnt/usb-backup
sudo mount /dev/sdb1 /mnt/usb-backup

# Setup cron with USB storage
sudo scripts/setup-backup-cron.sh --external /mnt/usb-backup
```

### Option 3: Cloud Storage (S3, Azure, Google Cloud)

**Using rclone:**

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure rclone (follow prompts)
rclone config

# Mount cloud storage
rclone mount remote:bucket /mnt/cloud-backup --daemon

# Setup cron with cloud storage
sudo scripts/setup-backup-cron.sh --external /mnt/cloud-backup
```

### Option 4: Rsync to Remote Server

Create a wrapper script `scripts/backup-to-remote.sh`:

```bash
#!/bin/bash
# Run local backup
/path/to/ResourceManager/scripts/pg-backup.sh

# Sync to remote server
rsync -avz --delete \
  /path/to/ResourceManager/backups/ \
  user@remote-server:/backups/resourcemanager/
```

---

## 🔧 Troubleshooting

### Problem: "Container 'postgres_db' is not running"

**Solution:**
```bash
# Check Docker containers
docker ps

# Start the database container
docker compose up -d postgres_db

# Verify it's running
docker ps | grep postgres_db
```

### Problem: ".env file not found"

**Solution:**
```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env
```

### Problem: "Permission denied"

**Solution:**
```bash
# Make scripts executable
chmod +x scripts/*.sh

# If still issues, check file ownership
ls -la scripts/

# Fix ownership if needed
sudo chown $USER:$USER scripts/*.sh
```

### Problem: Backup fails with "pg_dump: error"

**Solution:**
```bash
# Check database is healthy
docker exec postgres_db pg_isready -U rmuser

# Check logs
docker logs postgres_db

# Verify credentials in .env
cat .env | grep POSTGRES_
```

### Problem: Cron job not running

**Solution:**
```bash
# Check cron service
sudo systemctl status cron

# Start cron if stopped
sudo systemctl start cron

# Enable cron at boot
sudo systemctl enable cron

# Check cron logs
sudo grep CRON /var/log/syslog

# Verify crontab is installed
crontab -l
```

### Problem: Backup directory full

**Solution:**
```bash
# Check disk space
df -h

# List backup sizes
du -sh backups/*

# Manually delete old backups
rm backups/backup_resourcemanager_20260101_*.sql.gz

# Reduce retention period
sudo scripts/setup-backup-cron.sh --retention 3
```

### Problem: Cannot restore - "database does not exist"

**Solution:**
The backup includes database creation statements. Restore to the `postgres` database:
```bash
# The script automatically restores to 'postgres' database
# which then creates the target database
scripts/pg-restore.sh backups/backup_*.sql.gz
```

---

## 🎯 Advanced Usage

### Custom Backup Location

Edit `scripts/pg-backup.sh` and change:
```bash
BACKUP_DIR="${PROJECT_ROOT}/backups"
```

To:
```bash
BACKUP_DIR="/custom/path/backups"
```

### Email Notifications on Backup Failure

Install `mailutils`:
```bash
sudo apt-get install mailutils
```

Create wrapper script `scripts/backup-with-email.sh`:
```bash
#!/bin/bash
if ! /path/to/ResourceManager/scripts/pg-backup.sh; then
  echo "Backup failed on $(hostname)" | mail -s "Backup Alert" admin@example.com
fi
```

Update cron to use wrapper:
```bash
sudo scripts/setup-backup-cron.sh --remove
# Edit crontab manually
crontab -e
# Add: 0 2 * * * /path/to/ResourceManager/scripts/backup-with-email.sh
```

### Backup Specific Tables Only

```bash
# SSH into the container
docker exec -it postgres_db bash

# Backup specific tables
pg_dump -U rmuser -d resourcemanager -t invoices -t clients > specific-tables.sql
```

### Incremental Backups with WAL Archiving

For very large databases (>100GB), consider PostgreSQL's built-in WAL archiving for incremental backups.

**Edit `docker-compose.yml`:**
```yaml
postgres_db:
  environment:
    - POSTGRES_INITDB_ARGS=--wal-level=replica
  command: postgres -c archive_mode=on -c archive_command='cp %p /backups/archive/%f'
  volumes:
    - ./backups/archive:/backups/archive
```

### Monitor Backup Size Over Time

```bash
# Create monitoring script
cat > scripts/backup-stats.sh << 'EOF'
#!/bin/bash
echo "Backup Statistics:"
echo "=================="
echo "Total backups: $(ls -1 backups/backup_*.sql.gz 2>/dev/null | wc -l)"
echo "Total size: $(du -sh backups | cut -f1)"
echo "Oldest: $(ls -lt backups/backup_*.sql.gz 2>/dev/null | tail -1 | awk '{print $9}' | xargs basename)"
echo "Newest: $(ls -lt backups/backup_*.sql.gz 2>/dev/null | head -1 | awk '{print $9}' | xargs basename)"
EOF

chmod +x scripts/backup-stats.sh
scripts/backup-stats.sh
```

### Restore to Different Database

```bash
# Modify the backup file to change database name
gunzip -c backups/backup_resourcemanager_20260212.sql.gz | \
  sed 's/resourcemanager/new_database_name/g' | \
  docker exec -i postgres_db psql -U rmuser -d postgres
```

---

## 📊 Backup Best Practices

### ✅ DO

- **Test restores regularly** - A backup is only good if it can be restored
- **Store backups offsite** - Use external storage or cloud
- **Monitor backup sizes** - Ensure they're not growing unexpectedly
- **Keep multiple generations** - Don't rely on just one backup
- **Document your process** - Keep restoration instructions handy
- **Encrypt sensitive backups** - Use GPG or similar

### ❌ DON'T

- **Don't rely on a single backup location** - Always have offsite copies
- **Don't forget to test restores** - Untested backups are useless
- **Don't store passwords in scripts** - Use `.env` file instead
- **Don't skip monitoring** - Check logs regularly
- **Don't backup to same disk** - Use external storage

---

## 🔐 Security Considerations

### Encrypt Backups

```bash
# Backup and encrypt
scripts/pg-backup.sh
gpg --symmetric --cipher-algo AES256 backups/backup_resourcemanager_*.sql.gz

# Decrypt and restore
gpg --decrypt backups/backup_resourcemanager_*.sql.gz.gpg | \
  gunzip | docker exec -i postgres_db psql -U rmuser -d postgres
```

### Secure Backup Directory

```bash
# Restrict permissions
chmod 700 backups/
chown -R $USER:$USER backups/

# Prevent web server access
echo "deny from all" > backups/.htaccess
```

---

## 📞 Support

If you encounter issues:

1. Check logs: `tail -f backups/backup.log`
2. Verify Docker is running: `docker ps`
3. Test database connection: `docker exec postgres_db pg_isready`
4. Review this guide's troubleshooting section

---

## 📝 Cron Schedule Reference

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday=0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Examples:**
- `0 2 * * *` - Daily at 2:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday at midnight
- `30 3 * * 1-5` - Weekdays at 3:30 AM
- `0 0 1 * *` - Monthly on the 1st at midnight

---

## 🎉 Done!

Your PostgreSQL database is now protected with automated backups. Remember to:
- ✅ Test restore at least once a month
- ✅ Monitor backup logs regularly
- ✅ Ensure external storage is working
- ✅ Keep this documentation handy

**Happy backing up!** 🚀
