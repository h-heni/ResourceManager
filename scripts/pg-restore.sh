#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# PostgreSQL Docker Restore Script
# ═══════════════════════════════════════════════════════════════
# Purpose: Restore PostgreSQL database from backup
# Usage: ./pg-restore.sh <backup-file>
# Example: ./pg-restore.sh backups/backup_resourcemanager_20260212_120000.sql.gz
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTAINER_NAME="postgres_db"

# ═══════════════════════════════════════════════════════════════
# Functions
# ═══════════════════════════════════════════════════════════════

log() {
  local level=$1
  shift
  echo "[$level] $@"
}

usage() {
  cat << EOF
Usage: $0 <backup-file> [options]

Restore PostgreSQL database from a backup file.

Arguments:
  <backup-file>       Path to the backup file (.sql or .sql.gz)

Options:
  --no-confirm        Skip confirmation prompt
  --list-backups      List available backups and exit
  -h, --help          Show this help message

Examples:
  # List available backups
  $0 --list-backups

  # Restore with confirmation
  $0 backups/backup_resourcemanager_20260212_120000.sql.gz

  # Restore without confirmation (for automation)
  $0 backups/backup_resourcemanager_20260212_120000.sql.gz --no-confirm

EOF
}

list_backups() {
  local backup_dir="${PROJECT_ROOT}/backups"
  
  if [[ ! -d "$backup_dir" ]]; then
    log "ERROR" "Backup directory not found: $backup_dir"
    exit 1
  fi
  
  echo "Available backups in $backup_dir:"
  echo "================================================================"
  
  local backups=($(find "$backup_dir" -name "backup_*.sql.gz" -o -name "backup_*.sql" 2>/dev/null | sort -r))
  
  if [[ ${#backups[@]} -eq 0 ]]; then
    echo "No backups found."
    exit 0
  fi
  
  for backup in "${backups[@]}"; do
    local size=$(stat -f%z "$backup" 2>/dev/null || stat -c%s "$backup" 2>/dev/null)
    local size_mb=$(echo "scale=2; $size / 1024 / 1024" | bc)
    local date=$(stat -f%Sm -t '%Y-%m-%d %H:%M:%S' "$backup" 2>/dev/null || stat -c%y "$backup" 2>/dev/null | cut -d'.' -f1)
    printf "%-60s  %8s MB  %s\n" "$(basename "$backup")" "$size_mb" "$date"
  done
  
  echo "================================================================"
  echo "Total: ${#backups[@]} backup(s)"
}

check_docker() {
  if ! command -v docker &> /dev/null; then
    log "ERROR" "Docker is not installed or not in PATH"
    exit 1
  fi

  if ! docker ps &> /dev/null; then
    log "ERROR" "Docker daemon is not running or you don't have permission"
    exit 1
  fi
}

check_container() {
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "ERROR" "Container '${CONTAINER_NAME}' is not running"
    log "INFO" "Start the container with: docker compose up -d postgres_db"
    exit 1
  fi
}

load_env() {
  local env_file="${PROJECT_ROOT}/.env"
  if [[ ! -f "$env_file" ]]; then
    log "ERROR" ".env file not found at: $env_file"
    exit 1
  fi

  set -a
  source "$env_file"
  set +a

  if [[ -z "${POSTGRES_DB:-}" ]] || [[ -z "${POSTGRES_USER:-}" ]]; then
    log "ERROR" "Required environment variables not set in .env: POSTGRES_DB, POSTGRES_USER"
    exit 1
  fi
}

verify_backup_file() {
  local backup_file=$1
  
  if [[ ! -f "$backup_file" ]]; then
    log "ERROR" "Backup file not found: $backup_file"
    exit 1
  fi
  
  # If it's a gzip file, verify integrity
  if [[ "$backup_file" == *.gz ]]; then
    log "INFO" "Verifying backup file integrity..."
    if ! gzip -t "$backup_file" 2>/dev/null; then
      log "ERROR" "Backup file is corrupted or not a valid gzip file"
      exit 1
    fi
    log "INFO" "Backup file integrity verified"
  fi
}

create_pre_restore_backup() {
  log "WARN" "Creating safety backup of current database before restore..."
  
  local safety_backup="${PROJECT_ROOT}/backups/pre-restore_${POSTGRES_DB}_$(date +%Y%m%d_%H%M%S).sql.gz"
  
  if docker exec "$CONTAINER_NAME" pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --clean \
    --if-exists \
    --create \
    | gzip > "$safety_backup" 2>/dev/null; then
    
    log "INFO" "Safety backup created: $safety_backup"
    return 0
  else
    log "WARN" "Failed to create safety backup (database might be empty)"
    return 0
  fi
}

perform_restore() {
  local backup_file=$1
  
  log "INFO" "Starting restore from: $backup_file"
  log "INFO" "Target database: ${POSTGRES_DB}"
  log "INFO" "Container: ${CONTAINER_NAME}"
  
  # Decompress if needed and pipe to psql
  if [[ "$backup_file" == *.gz ]]; then
    log "INFO" "Decompressing and restoring..."
    if gunzip -c "$backup_file" | docker exec -i "$CONTAINER_NAME" psql \
      -U "$POSTGRES_USER" \
      -d postgres \
      > /dev/null 2>&1; then
      
      log "INFO" "Restore completed successfully"
      return 0
    else
      log "ERROR" "Restore failed"
      return 1
    fi
  else
    log "INFO" "Restoring uncompressed backup..."
    if docker exec -i "$CONTAINER_NAME" psql \
      -U "$POSTGRES_USER" \
      -d postgres \
      < "$backup_file" \
      > /dev/null 2>&1; then
      
      log "INFO" "Restore completed successfully"
      return 0
    else
      log "ERROR" "Restore failed"
      return 1
    fi
  fi
}

verify_restore() {
  log "INFO" "Verifying database connection..."
  
  if docker exec "$CONTAINER_NAME" psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -c "SELECT 'Database connection OK';" \
    > /dev/null 2>&1; then
    
    log "INFO" "Database connection verified"
    
    # Count tables
    local table_count=$(docker exec "$CONTAINER_NAME" psql \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" \
      2>/dev/null | tr -d ' \n')
    
    log "INFO" "Tables in database: $table_count"
    return 0
  else
    log "ERROR" "Database verification failed"
    return 1
  fi
}

# ═══════════════════════════════════════════════════════════════
# Main Execution
# ═══════════════════════════════════════════════════════════════

main() {
  local backup_file=""
  local no_confirm=false
  
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --list-backups)
        list_backups
        exit 0
        ;;
      --no-confirm)
        no_confirm=true
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        if [[ -z "$backup_file" ]]; then
          backup_file="$1"
        else
          log "ERROR" "Unknown option: $1"
          usage
          exit 1
        fi
        shift
        ;;
    esac
  done
  
  if [[ -z "$backup_file" ]]; then
    log "ERROR" "No backup file specified"
    usage
    exit 1
  fi
  
  log "INFO" "=== PostgreSQL Restore Started ==="
  
  # Pre-flight checks
  check_docker
  load_env
  check_container
  verify_backup_file "$backup_file"
  
  # Confirmation prompt
  if [[ "$no_confirm" == false ]]; then
    echo ""
    echo "⚠️  WARNING: This will REPLACE the current database!"
    echo "Database: ${POSTGRES_DB}"
    echo "Backup file: $backup_file"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirmation
    
    if [[ "$confirmation" != "yes" ]]; then
      log "INFO" "Restore cancelled by user"
      exit 0
    fi
  fi
  
  # Create safety backup
  create_pre_restore_backup
  
  # Perform restore
  if perform_restore "$backup_file"; then
    verify_restore
    log "INFO" "=== Restore Completed Successfully ==="
    exit 0
  else
    log "ERROR" "=== Restore Failed ==="
    log "INFO" "Check the safety backup in: ${PROJECT_ROOT}/backups/pre-restore_*"
    exit 1
  fi
}

main "$@"
