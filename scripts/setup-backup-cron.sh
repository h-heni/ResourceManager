#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Setup Cron Job for PostgreSQL Backups
# ═══════════════════════════════════════════════════════════════
# Purpose: Configure automated daily backups via cron
# Usage: sudo ./setup-backup-cron.sh [options]
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/pg-backup.sh"

# Default schedule: 2 AM daily
DEFAULT_SCHEDULE="0 2 * * *"

# ═══════════════════════════════════════════════════════════════
# Functions
# ═══════════════════════════════════════════════════════════════

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $@"
}

usage() {
  cat << EOF
Usage: $0 [options]

Setup automated PostgreSQL backups using cron.

Options:
  --schedule <cron>   Cron schedule (default: "0 2 * * *" = 2 AM daily)
  --external <path>   Optional external storage path
  --retention <days>  Number of backups to keep (default: 7)
  --user <username>   User to run cron job as (default: current user)
  --remove            Remove existing backup cron job
  -h, --help          Show this help message

Cron Schedule Examples:
  "0 2 * * *"         Every day at 2:00 AM
  "0 */6 * * *"       Every 6 hours
  "0 3 * * 0"         Every Sunday at 3:00 AM
  "30 1 * * *"        Every day at 1:30 AM

Examples:
  # Setup daily backup at 2 AM
  sudo $0

  # Setup backup every 6 hours
  sudo $0 --schedule "0 */6 * * *"

  # Setup with external storage
  sudo $0 --external /mnt/backup --retention 14

  # Remove backup cron job
  sudo $0 --remove

EOF
}

check_root() {
  if [[ $EUID -eq 0 ]]; then
    log "Running as root/sudo - OK"
  else
    log "ERROR: This script must be run with sudo"
    log "Usage: sudo $0"
    exit 1
  fi
}

verify_backup_script() {
  if [[ ! -f "$BACKUP_SCRIPT" ]]; then
    log "ERROR: Backup script not found: $BACKUP_SCRIPT"
    exit 1
  fi
  
  if [[ ! -x "$BACKUP_SCRIPT" ]]; then
    log "Making backup script executable..."
    chmod +x "$BACKUP_SCRIPT"
  fi
}

remove_existing_cron() {
  local user=$1
  local cron_comment="# ResourceManager PostgreSQL Backup"
  
  log "Checking for existing cron jobs..."
  
  # Get current crontab, remove our jobs, and reinstall
  if crontab -u "$user" -l 2>/dev/null | grep -v "$cron_comment" | grep -v "pg-backup.sh" > /tmp/crontab.tmp; then
    crontab -u "$user" /tmp/crontab.tmp
    rm /tmp/crontab.tmp
    log "Removed existing backup cron job for user: $user"
  else
    rm -f /tmp/crontab.tmp
    log "No existing backup cron job found"
  fi
}

install_cron() {
  local schedule=$1
  local user=$2
  local external_path=$3
  local retention=$4
  
  log "Installing cron job for user: $user"
  log "Schedule: $schedule"
  
  # Build the backup command
  local backup_cmd="$BACKUP_SCRIPT"
  
  if [[ -n "$external_path" ]]; then
    backup_cmd="$backup_cmd --external-path $external_path"
  fi
  
  if [[ -n "$retention" ]]; then
    backup_cmd="$backup_cmd --retention-days $retention"
  fi
  
  # Redirect output to log file
  backup_cmd="$backup_cmd >> ${PROJECT_ROOT}/backups/backup.log 2>&1"
  
  # Create cron entry
  local cron_entry="# ResourceManager PostgreSQL Backup
$schedule cd $PROJECT_ROOT && $backup_cmd"
  
  # Install to crontab
  (crontab -u "$user" -l 2>/dev/null || true; echo "$cron_entry") | crontab -u "$user" -
  
  log "Cron job installed successfully!"
  echo ""
  log "Cron entry:"
  echo "  $schedule cd $PROJECT_ROOT && $backup_cmd"
  echo ""
}

verify_cron() {
  local user=$1
  
  log "Verifying cron installation..."
  echo ""
  log "Current crontab for user '$user':"
  echo "================================================================"
  crontab -u "$user" -l 2>/dev/null || echo "No crontab entries found"
  echo "================================================================"
  echo ""
}

check_dependencies() {
  log "Checking dependencies..."
  
  local missing=()
  
  if ! command -v docker &> /dev/null; then
    missing+=("docker")
  fi
  
  if ! command -v gzip &> /dev/null; then
    missing+=("gzip")
  fi
  
  if ! command -v bc &> /dev/null; then
    missing+=("bc")
  fi
  
  if [[ ${#missing[@]} -gt 0 ]]; then
    log "ERROR: Missing required dependencies: ${missing[*]}"
    log "Install with: apt-get install ${missing[*]}"
    exit 1
  fi
  
  log "All dependencies are installed"
}

create_backup_directory() {
  local backup_dir="${PROJECT_ROOT}/backups"
  
  if [[ ! -d "$backup_dir" ]]; then
    mkdir -p "$backup_dir"
    log "Created backup directory: $backup_dir"
  fi
  
  # Set appropriate permissions
  chmod 755 "$backup_dir"
}

test_backup_script() {
  log "Testing backup script..."
  
  if sudo -u "$TARGET_USER" "$BACKUP_SCRIPT" --help > /dev/null 2>&1; then
    log "Backup script test passed"
  else
    log "ERROR: Backup script test failed"
    exit 1
  fi
}

# ═══════════════════════════════════════════════════════════════
# Main Execution
# ═══════════════════════════════════════════════════════════════

main() {
  local schedule="$DEFAULT_SCHEDULE"
  local external_path=""
  local retention="7"
  local remove_only=false
  local target_user="${SUDO_USER:-$USER}"
  
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --schedule)
        schedule="$2"
        shift 2
        ;;
      --external)
        external_path="$2"
        shift 2
        ;;
      --retention)
        retention="$2"
        shift 2
        ;;
      --user)
        target_user="$2"
        shift 2
        ;;
      --remove)
        remove_only=true
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        log "ERROR: Unknown option: $1"
        usage
        exit 1
        ;;
    esac
  done
  
  # Export for use in functions
  TARGET_USER="$target_user"
  
  log "=== PostgreSQL Backup Cron Setup ==="
  
  check_root
  check_dependencies
  verify_backup_script
  create_backup_directory
  
  # Remove existing cron job
  remove_existing_cron "$target_user"
  
  if [[ "$remove_only" == true ]]; then
    log "Cron job removed successfully"
    exit 0
  fi
  
  # Test the backup script
  test_backup_script
  
  # Install new cron job
  install_cron "$schedule" "$target_user" "$external_path" "$retention"
  
  # Verify installation
  verify_cron "$target_user"
  
  log "=== Setup Complete ==="
  echo ""
  log "Next steps:"
  echo "  1. Verify cron is running: systemctl status cron"
  echo "  2. Test backup manually: $BACKUP_SCRIPT"
  echo "  3. Check logs: tail -f ${PROJECT_ROOT}/backups/backup.log"
  echo ""
  log "Backups will run: $schedule"
  log "Retention period: $retention days"
  if [[ -n "$external_path" ]]; then
    log "External storage: $external_path"
  fi
}

main "$@"
