# Systemd Service Alternative to Cron

If you prefer using systemd timers instead of cron, here's how to set it up.

## Why Systemd Instead of Cron?

**Advantages:**
- Better logging integration with `journalctl`
- More flexible scheduling options
- Dependency management
- Automatic retry on failure
- Can see last run status with `systemctl status`

**Disadvantages:**
- Slightly more complex setup
- Two files needed (service + timer)

---

## Setup Instructions

### Step 1: Create Service File

Create `/etc/systemd/system/resourcemanager-backup.service`:

```bash
sudo nano /etc/systemd/system/resourcemanager-backup.service
```

Paste this content (adjust paths):

```ini
[Unit]
Description=ResourceManager PostgreSQL Backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=your-username
Group=your-username
WorkingDirectory=/path/to/ResourceManager
ExecStart=/path/to/ResourceManager/scripts/pg-backup.sh
StandardOutput=append:/path/to/ResourceManager/backups/backup.log
StandardError=append:/path/to/ResourceManager/backups/backup.log

# Optional: External storage
# ExecStart=/path/to/ResourceManager/scripts/pg-backup.sh --external-path /mnt/backup --retention-days 7

# Security hardening
PrivateTmp=true
NoNewPrivileges=true
```

### Step 2: Create Timer File

Create `/etc/systemd/system/resourcemanager-backup.timer`:

```bash
sudo nano /etc/systemd/system/resourcemanager-backup.timer
```

Paste this content:

```ini
[Unit]
Description=ResourceManager PostgreSQL Backup Timer
Requires=resourcemanager-backup.service

[Timer]
# Run daily at 2:00 AM
OnCalendar=daily
# More specific: OnCalendar=02:00:00
# Every 6 hours: OnCalendar=*-*-* 00,06,12,18:00:00
# Weekly Sunday 3 AM: OnCalendar=Sun 03:00:00

# If the system was off, run backup when it comes back online
Persistent=true

# Random delay (0-15 minutes) to avoid all servers backing up at once
RandomizedDelaySec=15min

[Install]
WantedBy=timers.target
```

### Step 3: Enable and Start

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable timer (start at boot)
sudo systemctl enable resourcemanager-backup.timer

# Start timer now
sudo systemctl start resourcemanager-backup.timer

# Check status
sudo systemctl status resourcemanager-backup.timer
```

---

## Usage

### Check Timer Status

```bash
# View timer status
sudo systemctl status resourcemanager-backup.timer

# List all timers
systemctl list-timers

# See next scheduled run
systemctl list-timers resourcemanager-backup.timer
```

### Check Service Status

```bash
# View last backup run status
sudo systemctl status resourcemanager-backup.service

# View backup logs
sudo journalctl -u resourcemanager-backup.service

# Follow logs in real-time
sudo journalctl -u resourcemanager-backup.service -f

# View logs from last 24 hours
sudo journalctl -u resourcemanager-backup.service --since "24 hours ago"
```

### Manual Trigger

```bash
# Run backup immediately (outside of schedule)
sudo systemctl start resourcemanager-backup.service

# Watch it run
sudo journalctl -u resourcemanager-backup.service -f
```

### Modify Schedule

```bash
# Edit timer
sudo nano /etc/systemd/system/resourcemanager-backup.timer

# Reload after changes
sudo systemctl daemon-reload

# Restart timer
sudo systemctl restart resourcemanager-backup.timer
```

### Stop/Disable

```bash
# Stop timer
sudo systemctl stop resourcemanager-backup.timer

# Disable (won't start at boot)
sudo systemctl disable resourcemanager-backup.timer
```

---

## OnCalendar Schedule Examples

```ini
# Daily at 2 AM
OnCalendar=02:00:00

# Every 6 hours
OnCalendar=*-*-* 00,06,12,18:00:00

# Every day at 1:30 AM
OnCalendar=01:30:00

# Every Sunday at 3 AM
OnCalendar=Sun 03:00:00

# First day of every month at midnight
OnCalendar=*-*-01 00:00:00

# Every 15 minutes (not recommended for backups)
OnCalendar=*:0/15

# Weekdays at 6 AM
OnCalendar=Mon-Fri 06:00:00
```

Test your schedule:
```bash
systemd-analyze calendar "02:00:00"
systemd-analyze calendar "Sun 03:00:00"
```

---

## Troubleshooting

### Timer not running?

```bash
# Check if timer is enabled
systemctl is-enabled resourcemanager-backup.timer

# Check if timer is active
systemctl is-active resourcemanager-backup.timer

# View timer details
systemctl list-timers --all | grep resourcemanager
```

### Service failing?

```bash
# Check service status
sudo systemctl status resourcemanager-backup.service

# View error logs
sudo journalctl -u resourcemanager-backup.service -n 50

# Test service manually
sudo systemctl start resourcemanager-backup.service
```

### Wrong user or paths?

Edit the service file:
```bash
sudo nano /etc/systemd/system/resourcemanager-backup.service

# Change User, Group, WorkingDirectory, and ExecStart paths

# Then reload
sudo systemctl daemon-reload
sudo systemctl restart resourcemanager-backup.timer
```

---

## Monitoring Example

Create a monitoring script `/usr/local/bin/check-backup.sh`:

```bash
#!/bin/bash
LAST_BACKUP=$(find /path/to/ResourceManager/backups -name "backup_*.sql.gz" -type f -mtime -1 | wc -l)

if [ "$LAST_BACKUP" -eq 0 ]; then
  echo "WARNING: No backup created in last 24 hours!"
  # Send alert email
  echo "No backup in 24h" | mail -s "Backup Alert" admin@example.com
  exit 1
else
  echo "OK: Backup exists from last 24 hours"
  exit 0
fi
```

Add to cron to check daily:
```bash
0 9 * * * /usr/local/bin/check-backup.sh
```

---

## Migration from Cron to Systemd

If you're currently using cron:

```bash
# 1. Remove cron job
sudo scripts/setup-backup-cron.sh --remove

# 2. Setup systemd (follow steps above)

# 3. Verify systemd is working
sudo systemctl start resourcemanager-backup.service
sudo journalctl -u resourcemanager-backup.service
```

---

## Comparison: Cron vs Systemd

| Feature | Cron | Systemd |
|---------|------|---------|
| Setup complexity | Simple (1 line) | Moderate (2 files) |
| Logging | Manual redirection | Built-in journalctl |
| View last run | Check log file | `systemctl status` |
| Dependencies | None | Can specify (e.g., Docker) |
| Retry on failure | Manual | Can configure |
| Random delay | Manual | Built-in |
| Email on failure | Manual (with script) | Can integrate |

---

## Recommendation

- **Use Cron if:** You want simplicity and are comfortable with cron syntax
- **Use Systemd if:** You want better logging, monitoring, and are running other systemd services

Both work equally well for scheduled backups. Choose based on your preference and infrastructure.

---

**For most users, the cron setup (via `setup-backup-cron.sh`) is recommended for simplicity.**
