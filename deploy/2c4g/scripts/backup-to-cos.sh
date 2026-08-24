#!/bin/bash
set -euo pipefail

# Automated daily cold backup script for 2C4G Tencent Cloud host
BACKUP_DIR="/var/backups/renwork"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/renwork_den_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[${TIMESTAMP}] Starting MySQL database dump..."
docker exec renwork-mysql mysqldump --single-transaction --quick -u renwork_user -p"${DB_PASSWORD}" renwork_den | gzip -9 > "${BACKUP_FILE}"

echo "[${TIMESTAMP}] Database dumped to ${BACKUP_FILE} ($(du -h ${BACKUP_FILE} | cut -f1))"

# Keep only last 7 days of local backups
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +7 -delete

echo "[${TIMESTAMP}] Backup completed successfully."
