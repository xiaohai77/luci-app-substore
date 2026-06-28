#!/bin/sh
# Post-install script for luci-app-substore

# 初始化数据目录
mkdir -p /etc/sub-store

# 设置init.d权限并启用
chmod +x /etc/init.d/substore
/etc/init.d/substore enable

echo "Sub-Store installed. Enable it in Services > Sub-Store."
