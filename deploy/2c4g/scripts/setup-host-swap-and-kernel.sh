#!/bin/bash
set -euo pipefail

echo "========================================================"
echo "RenWork 2C4G Tencent Cloud Kernel & Swap Hardening"
echo "========================================================"

# 1. Configure 4GB NVMe Swapfile if not present
if [ ! -f /swapfile ]; then
    echo "[1/4] Creating 4GB Swapfile..."
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    echo "4GB Swapfile created and activated successfully."
else
    echo "[1/4] Swapfile already exists."
    swapon /swapfile 2>/dev/null || true
fi

# 2. Kernel Virtual Memory Hardening in sysctl.conf
echo "[2/4] Applying sysctl virtual memory parameters..."
cat << 'SYSCTL_EOF' > /etc/sysctl.d/99-renwork-2c4g.conf
# RenWork 2C4G Hardening Parameters
vm.swappiness=10
vm.overcommit_memory=1
vm.vfs_cache_pressure=50
net.core.somaxconn=1024
net.ipv4.tcp_max_syn_backlog=2048
net.ipv4.ip_local_port_range=1024 65535
SYSCTL_EOF

sysctl -p /etc/sysctl.d/99-renwork-2c4g.conf

# 3. Configure Logrotate for Docker and Nginx
echo "[3/4] Setting up logrotate policies (7-day max retention)..."
cat << 'LOGROTATE_EOF' > /etc/logrotate.d/renwork-logs
/var/log/nginx/*.log /var/lib/docker/containers/*/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
}
LOGROTATE_EOF

# 4. Verify system memory status
echo "[4/4] System Memory and Swap Status:"
free -h
echo "========================================================"
echo "2C4G Kernel & Swap Hardening Complete!"
echo "========================================================"
