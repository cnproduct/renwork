#!/usr/bin/env python3
"""
RenWork Buyer Intent 360 Cloud API 本地开发服务器启动脚本
严格遵从规范，在本地 127.0.0.1:8000 启动，不向外部生产环境发布
"""

import uvicorn
import os
import sys

# 添加当前目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("==================================================================")
    print("  Starting RenWork Buyer Intent 360 Cloud API (Local Sandbox)    ")
    print("  Endpoints available at: http://127.0.0.1:8000/docs             ")
    print("  Strict Local Dev Policy Active: NO EXTERNAL DEPLOYMENT         ")
    print("==================================================================")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
