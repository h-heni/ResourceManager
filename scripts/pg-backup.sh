#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# PostgreSQL Docker Backup Script
# ═══════════════════════════════════════════════════════════════
# Purpose: Automated PostgreSQL backup with compression and rotation
# Usage: ./pg-backup.sh [options]
# Options:
#   --external-path <path>  Optional: Copy backup to external storage
#   --retention-days <num>  Number of backups to keep (default: 7)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail  # Exit on error, undefined variable, or pipe failure

# ═══════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════

# Get the script directory (absolute path)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Backup directory (local storage)
BACKUP_DIR="${PROJECT_ROOT}/backups"

# Docker container name (from docker-compose.yml)
CONTAINER_NAME="postgres_db"

# Default retention period (days)
RETENTION_DAYS=7

# External storage path (optional)
EXTERNAL_PATH=""

# Timestamp format
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Log file
LOG_FILE="${BACKUP_DIR}/backup.log"

# ═══════════════════════════════════════════════════════════════
# Parse Arguments
# ═══════════════════════════════════════════════════════════════

while [[ $# -gt 0 ]]; do
  case $1 in
    --external-path)
      EXTERNAL_PATH="$2"
      shift 2
      ;;
    --retention-days)
      RETENTION_DAYS="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --external-path <path>  Copy backup to external storage"
      echo "  --retention-days <num>  Number of backups to keep (default: 7)"
      echo "  -h, --help             Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# ═══════════════════════════════════════════════════════════════
# Functions
# ═══════════════════════════════════════════════════════════════

log() {
  local level=$1
  shift
  local message="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
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
    log "INFO" "Available containers: $(docker ps --format '{{.Names}}' | tr '\n' ', ')"
    exit 1
  fi
}

load_env() {
  local env_file="${PROJECT_ROOT}/.env"
  if [[ ! -f "$env_file" ]]; then
    log "ERROR" ".env file not found at: $env_file"
    exit 1
  fi

  # Source the .env file
  set -a  # automatically export all variables
  source "$env_file"
  set +a

  # Validate required variables
  if [[ -z "${POSTGRES_DB:-}" ]] || [[ -z "${POSTGRES_USER:-}" ]] || [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    log "ERROR" "Required environment variables not set in .env: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD"
    exit 1
  fi
}

create_backup_dir() {
  if [[ ! -d "$BACKUP_DIR" ]]; then
    mkdir -p "$BACKUP_DIR"
    log "INFO" "Created backup directory: $BACKUP_DIR"
  fi
}

perform_backup() {
  local backup_file="${BACKUP_DIR}/backup_${POSTGRES_DB}_${TIMESTAMP}.sql"
  local compressed_file="${backup_file}.gz"

  log "INFO" "Starting backup of database: ${POSTGRES_DB}"
  log "INFO" "Container: ${CONTAINER_NAME}"

  # Perform the backup using pg_dump
  if docker exec "$CONTAINER_NAME" pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --clean \
    --if-exists \
    --create \
    --no-owner \
    --no-acl \
    > "$backup_file" 2>> "$LOG_FILE"; then
    
    log "INFO" "Database dump completed: $backup_file"
    
    # Get uncompressed size
    local size_bytes=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    local size_mb=$(echo "scale=2; $size_bytes / 1024 / 1024" | bc)
    log "INFO" "Uncompressed size: ${size_mb} MB"
    
    # Compress the backup
    log "INFO" "Compressing backup..."
    if gzip -f "$backup_file"; then
      log "INFO" "Compression completed: $compressed_file"
      
      # Get compressed size
      local compressed_size=$(stat -f%z "$compressed_file" 2>/dev/null || stat -c%s "$compressed_file" 2>/dev/null)
      local compressed_mb=$(echo "scale=2; $compressed_size / 1024 / 1024" | bc)
      local ratio=$(echo "scale=1; 100 - ($compressed_size * 100 / $size_bytes)" | bc)
      log "INFO" "Compressed size: ${compressed_mb} MB (${ratio}% reduction)"
      
      echo "$compressed_file"
      return 0
    else
      log "ERROR" "Compression failed"
      return 1
    fi
  else
    log "ERROR" "Database dump failed"
    return 1
  fi
}

copy_to_external() {
  local backup_file=$1
  
  if [[ -z "$EXTERNAL_PATH" ]]; then
    return 0
  fi

  log "INFO" "Copying backup to external storage: $EXTERNAL_PATH"
  
  if [[ ! -d "$EXTERNAL_PATH" ]]; then
    log "WARN" "External path does not exist, attempting to create: $EXTERNAL_PATH"
    if ! mkdir -p "$EXTERNAL_PATH" 2>> "$LOG_FILE"; then
      log "ERROR" "Failed to create external directory"
      return 1
    fi
  fi

  if cp "$backup_file" "$EXTERNAL_PATH/"; then
    log "INFO" "Backup copied to external storage successfully"
    return 0
  else
    log "ERROR" "Failed to copy backup to external storage"
    return 1
  fi
}

rotate_backups() {
  log "INFO" "Rotating backups (keeping last ${RETENTION_DAYS} backups)"
  
  # Count existing backups
  local backup_count=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f | wc -l)
  log "INFO" "Current backup count: $backup_count"
  
  # Remove old backups (keep only the last N)
  local deleted_count=0
  while IFS= read -r old_backup; do
    if rm "$old_backup" 2>> "$LOG_FILE"; then
      log "INFO" "Deleted old backup: $(basename "$old_backup")"
      ((deleted_count++))
    else
      log "WARN" "Failed to delete: $(basename "$old_backup")"
    fi
  done < <(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | \
           sort -n | head -n -${RETENTION_DAYS} | cut -d' ' -f2- || \
           find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -print0 | \
           xargs -0 ls -t | tail -n +$((RETENTION_DAYS + 1)))
  
  if [[ $deleted_count -gt 0 ]]; then
    log "INFO" "Deleted $deleted_count old backup(s)"
  else
    log "INFO" "No old backups to delete"
  fi
  
  # If external path is configured, rotate there too
  if [[ -n "$EXTERNAL_PATH" ]] && [[ -d "$EXTERNAL_PATH" ]]; then
    log "INFO" "Rotating external backups"
    while IFS= read -r old_backup; do
      if rm "$old_backup" 2>> "$LOG_FILE"; then
        log "INFO" "Deleted old external backup: $(basename "$old_backup")"
      fi
    done < <(find "$EXTERNAL_PATH" -name "backup_*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | \
             sort -n | head -n -${RETENTION_DAYS} | cut -d' ' -f2- || \
             find "$EXTERNAL_PATH" -name "backup_*.sql.gz" -type f -print0 | \
             xargs -0 ls -t | tail -n +$((RETENTION_DAYS + 1)))
  fi
}

verify_backup() {
  local backup_file=$1
  
  if [[ ! -f "$backup_file" ]]; then
    log "ERROR" "Backup file not found: $backup_file"
    return 1
  fi
  
  # Test that the gzip file is valid
  if gzip -t "$backup_file" 2>> "$LOG_FILE"; then
    log "INFO" "Backup file integrity verified"
    return 0
  else
    log "ERROR" "Backup file is corrupted!"
    return 1
  fi
}

# ═══════════════════════════════════════════════════════════════
# Main Execution
# ═══════════════════════════════════════════════════════════════

main() {
  log "INFO" "=== PostgreSQL Backup Started ==="
  
  # Pre-flight checks
  check_docker
  load_env
  check_container
  create_backup_dir
  
  # Perform backup
  if backup_file=$(perform_backup); then
    # Verify backup integrity
    if verify_backup "$backup_file"; then
      # Copy to external storage if configured
      copy_to_external "$backup_file"
      
      # Rotate old backups
      rotate_backups
      
      log "INFO" "=== Backup Completed Successfully ==="
      exit 0
    else
      log "ERROR" "=== Backup Failed: Integrity Check Failed ==="
      exit 1
    fi
  else
    log "ERROR" "=== Backup Failed ==="
    exit 1
  fi
}

# Run main function
main "$@"
