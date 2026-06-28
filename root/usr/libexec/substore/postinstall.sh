#!/bin/sh
# Post-install script for luci-app-substore
# Downloads sub-store.bundle.js and frontend from GitHub releases

BUNDLE_DIR="/usr/libexec/substore"
BUNDLE_FILE="$BUNDLE_DIR/sub-store.bundle.js"
BUNDLE_URL="https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.bundle.js"
FRONTEND_DIR="/www/sub-store/dist"
FRONTEND_URL="https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip"

mkdir -p "$BUNDLE_DIR"

# 下载后端
if [ ! -f "$BUNDLE_FILE" ]; then
	echo "Downloading sub-store.bundle.js ..."
	if command -v curl >/dev/null 2>&1; then
		curl -sSL -o "$BUNDLE_FILE" "$BUNDLE_URL" && echo "Backend download OK" || echo "Backend download failed, please manually download to $BUNDLE_FILE"
	elif command -v wget >/dev/null 2>&1; then
		wget -q -O "$BUNDLE_FILE" "$BUNDLE_URL" && echo "Backend download OK" || echo "Backend download failed, please manually download to $BUNDLE_FILE"
	else
		echo "ERROR: Neither curl nor wget found."
	fi
fi

# 下载前端
if [ ! -d "$FRONTEND_DIR" ]; then
	echo "Downloading Sub-Store frontend ..."
	mkdir -p /www/sub-store
	if command -v curl >/dev/null 2>&1; then
		curl -sSL -o /tmp/dist.zip "$FRONTEND_URL"
	elif command -v wget >/dev/null 2>&1; then
		wget -q -O /tmp/dist.zip "$FRONTEND_URL"
	fi
	if [ -f /tmp/dist.zip ]; then
		opkg install unzip 2>/dev/null || true
		unzip -q /tmp/dist.zip -d /www/sub-store && echo "Frontend download OK" || echo "Frontend unzip failed"
		rm -f /tmp/dist.zip
	else
		echo "Frontend download failed"
	fi
fi

# 初始化数据目录
mkdir -p /etc/sub-store

# 设置init.d权限并启用
chmod +x /etc/init.d/substore
/etc/init.d/substore enable

echo "Sub-Store installed. Enable it in Services > Sub-Store."
