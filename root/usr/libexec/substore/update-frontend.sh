#!/bin/sh
set -e

WGET=$(command -v wget)
MV=$(command -v mv)
RM=$(command -v rm)
FIND=$(command -v find)
UNZIP=$(command -v unzip)

ZIP_PATH=/tmp/dist.zip
DIST_PATH=/www/sub-store/dist
DIST_BAK_PATH=/www/sub-store/dist.bak
DIST_NEW_PATH=/www/sub-store/dist.new

if [ -z "$WGET" ] || [ -z "$UNZIP" ]; then
	echo "FAIL: wget 或 unzip 命令未找到" >&2
	exit 1
fi

"$WGET" -q -O "$ZIP_PATH" "https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip"

if [ ! -s "$ZIP_PATH" ]; then
	"$RM" -f "$ZIP_PATH"
	echo "FAIL: 下载失败，文件为空" >&2
	exit 1
fi

"$RM" -rf "$DIST_NEW_PATH"
mkdir -p "$DIST_NEW_PATH"
"$UNZIP" -q "$ZIP_PATH" -d "$DIST_NEW_PATH"

INDEX_PATH=$("$FIND" "$DIST_NEW_PATH" -maxdepth 4 -name index.html -print | head -n 1)

if [ -z "$INDEX_PATH" ]; then
	"$RM" -rf "$DIST_NEW_PATH" "$ZIP_PATH"
	echo "FAIL: 解压结果中未找到 index.html" >&2
	exit 1
fi

REAL_ROOT=$(dirname "$INDEX_PATH")

"$RM" -rf "$DIST_BAK_PATH"
[ -d "$DIST_PATH" ] && "$MV" "$DIST_PATH" "$DIST_BAK_PATH"
"$MV" "$REAL_ROOT" "$DIST_PATH"
"$RM" -rf "$DIST_NEW_PATH" "$ZIP_PATH"

if [ ! -f "$DIST_PATH/index.html" ]; then
	echo "FAIL: 切换后未找到 index.html" >&2
	exit 1
fi

echo "OK"
exit 0
