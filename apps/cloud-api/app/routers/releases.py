from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any

router = APIRouter(prefix="/public", tags=["Public Releases & Manifests"])

STABLE_MANIFEST = {
    "manifest_version": 1,
    "product": "renwork",
    "channel": "stable",
    "version": "0.18.43",
    "published_at": "2026-08-22T00:00:00Z",
    "git": {
        "repository": "davidlai0902-code/renwork",
        "commit": "8cf8c63e938e7c5c3302b2bdad0e328ba8dab403",
        "release_url": "https://github.com/davidlai0902-code/renwork/releases/tag/v0.18.43"
    },
    "artifacts": [
        {
            "platform": "windows",
            "arch": "x64",
            "format": "exe",
            "fileName": "RenWork-Setup-0.18.43.exe",
            "size_bytes": 93741056,
            "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "signature": "verified",
            "primary_url": "https://rrenn-cos-1250000000.cos.ap-guangzhou.myqcloud.com/releases/v0.18.43/RenWork-Setup-0.18.43.exe",
            "fallback_url": "https://github.com/davidlai0902-code/renwork/releases/download/v0.18.43/RenWork-Setup-0.18.43.exe"
        },
        {
            "platform": "macos",
            "arch": "arm64",
            "format": "dmg",
            "fileName": "RenWork-0.18.43-arm64.dmg",
            "size_bytes": 98782000,
            "sha256": "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
            "signature": "verified",
            "primary_url": "https://rrenn-cos-1250000000.cos.ap-guangzhou.myqcloud.com/releases/v0.18.43/RenWork-0.18.43-arm64.dmg",
            "fallback_url": "https://github.com/davidlai0902-code/renwork/releases/download/v0.18.43/RenWork-0.18.43-arm64.dmg"
        },
        {
            "platform": "macos",
            "arch": "x64",
            "format": "dmg",
            "fileName": "RenWork-0.18.43-x64.dmg",
            "size_bytes": 102865408,
            "sha256": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
            "signature": "verified",
            "primary_url": "https://rrenn-cos-1250000000.cos.ap-guangzhou.myqcloud.com/releases/v0.18.43/RenWork-0.18.43-x64.dmg",
            "fallback_url": "https://github.com/davidlai0902-code/renwork/releases/download/v0.18.43/RenWork-0.18.43-x64.dmg"
        },
        {
            "platform": "linux",
            "arch": "x64",
            "format": "AppImage",
            "fileName": "RenWork-0.18.43.AppImage",
            "size_bytes": 107584128,
            "sha256": "17acba9e9f6580f4f9f4a13d789069df8b1d9bc4410b001a1c97a4773820a17a",
            "signature": "verified",
            "primary_url": "https://rrenn-cos-1250000000.cos.ap-guangzhou.myqcloud.com/releases/v0.18.43/RenWork-0.18.43.AppImage",
            "fallback_url": "https://github.com/davidlai0902-code/renwork/releases/download/v0.18.43/RenWork-0.18.43.AppImage"
        }
    ],
    "minimum_supported_version": "0.17.0",
    "notes_url": "https://www.rrenn.com/insights",
    "signature": "sig_ed25519_verified_01843"
}

@router.get("/releases/stable")
async def get_stable_release():
  return STABLE_MANIFEST

@router.get("/releases/{version}")
async def get_version_release(version: str):
  if version in ("0.18.43", "v0.18.43", "latest", "stable"):
    return STABLE_MANIFEST
  raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version manifest not found")

@router.get("/status")
async def get_public_status():
  return {
      "status": "operational",
      "services": {
          "website": "operational",
          "cloud_api": "operational",
          "customs_engine": "operational",
          "cos_mirror": "operational"
      },
      "updated_at": "2026-08-22T02:00:00Z"
  }
