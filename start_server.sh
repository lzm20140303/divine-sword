#!/bin/bash
# 神剑仙域 — 一键启动 HTTP 服务器
# ES Module 需要 HTTP 协议，不能用 file:// 直接打开

cd "$(dirname "$0")"

# 检测可用端口
PORT=8080
if command -v python3 &> /dev/null; then
    echo "🚀 启动神剑仙域..."
    echo "📡 访问: http://localhost:$PORT/index.html"
    echo "⏹️  按 Ctrl+C 停止服务器"
    echo ""
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    echo "🚀 启动神剑仙域..."
    echo "📡 访问: http://localhost:$PORT/index.html"
    python -m SimpleHTTPServer $PORT
elif command -v npx &> /dev/null; then
    echo "🚀 启动神剑仙域..."
    npx serve -l $PORT .
else
    echo "❌ 未找到 Python 或 Node.js"
    echo "请安装其中之一，或手动用任意 HTTP 服务器托管本目录"
fi
