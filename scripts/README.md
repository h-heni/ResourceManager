# Backup Scripts

This directory contains scripts for automated PostgreSQL database backups.

## Scripts

### 🔹 pg-backup.sh
Performs database backup with compression and rotation.

**Usage:**
```bash
./pg-backup.sh [options]
```

**Options:**
- `--external-path <path>` - Copy backup to external storage
- `--retention-days <num>` - Number of backups to keep (default: 7)
- `-h, --help` - Show help message

**Examples:**
```bash
# Basic backup
./pg-backup.sh

# Backup with external storage
./pg-backup.sh --external-path /mnt/backup

# Keep last 14 backups
./pg-backup.sh --retention-days 14
```

---

### 🔹 pg-restore.sh
Restores database from a backup file.

**Usage:**
```bash
./pg-restore.sh <backup-file> [options]
```

**Options:**
- `--no-confirm` - Skip confirmation prompt (for automation)
- `--list-backups` - List available backups and exit
- `-h, --help` - Show help message

**Examples:**
```bash
# List available backups
./pg-restore.sh --list-backups

# Restore with confirmation
./pg-restore.sh ../backups/backup_resourcemanager_20260212_120000.sql.gz

# Restore without confirmation
./pg-restore.sh ../backups/backup_resourcemanager_20260212_120000.sql.gz --no-confirm
```

---

### 🔹 setup-backup-cron.sh
Configures automated backups via cron.

**⚠️ Must be run with sudo**

**Usage:**
```bash
sudo ./setup-backup-cron.sh [options]
```

**Options:**
- `--schedule <cron>` - Cron schedule (default: "0 2 * * *" = 2 AM daily)
- `--external <path>` - Optional external storage path
- `--retention <days>` - Number of backups to keep (default: 7)
- `--user <username>` - User to run cron job as (default: current user)
- `--remove` - Remove existing backup cron job
- `-h, --help` - Show help message

**Examples:**
```bash
# Setup daily backup at 2 AM
sudo ./setup-backup-cron.sh

# Setup backup every 6 hours
sudo ./setup-backup-cron.sh --schedule "0 */6 * * *"

# Setup with external storage
sudo ./setup-backup-cron.sh --external /mnt/backup --retention 14

# Remove backup cron job
sudo ./setup-backup-cron.sh --remove
```

---

## Quick Start

```bash
# 1. Make scripts executable (if not already)
chmod +x *.sh

# 2. Setup automated daily backups
sudo ./setup-backup-cron.sh

# 3. Test manual backup
./pg-backup.sh
```

---

## Documentation

See [BACKUP_GUIDE.md](../BACKUP_GUIDE.md) for complete documentation including:
- Setup instructions
- Restore procedures
- External storage configuration
- Troubleshooting
- Advanced usage

---

## Requirements

- Docker & Docker Compose
- PostgreSQL container running (container name: `postgres_db`)
- `.env` file with database credentials
- `gzip` (for compression)
- `bc` (for size calculations)

Install missing dependencies:
```bash
sudo apt-get install -y bc gzip
```

---

## Backup Location

Backups are stored in: `../backups/`

Format: `backup_<database>_<timestamp>.sql.gz`

Example: `backup_resourcemanager_20260212_143022.sql.gz`

---

## Support

For issues or questions, refer to the troubleshooting section in [BACKUP_GUIDE.md](../BACKUP_GUIDE.md).
