#!/usr/bin/env python3
"""
Recursively delete .webp files from:

    public/images/products/monitor

SAFE DEFAULT:
- Only deletes a .webp when a same-name .png exists beside it.
  Example:
      koorui-s3241xo-32-inch-4k-gaming-monitor.webp
      koorui-s3241xo-32-inch-4k-gaming-monitor.png
  => WEBP is deleted.

- Scans all subfolders/child folders recursively.
- --dry-run previews without deleting anything.
- --delete-all-webp deletes every WEBP even if matching PNG does not exist.
- Writes a JSON manifest/report.

Examples:
    # Recommended first
    python delete_monitor_webp.py --project-root . --dry-run

    # Safe delete: only WEBP files that already have matching PNG
    python delete_monitor_webp.py --project-root .

    # DANGEROUS: delete every WEBP in monitor tree
    python delete_monitor_webp.py --project-root . --delete-all-webp
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path


DEFAULT_MONITOR_DIR = "public/images/products/monitor"
DEFAULT_MANIFEST = "monitor_webp_delete_manifest.json"


def save_manifest(path: Path, data: dict) -> None:
    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser(
        description="Recursively delete WEBP files from Monitor image folders."
    )
    ap.add_argument(
        "--project-root",
        default=".",
        help="Project root. Default: current directory",
    )
    ap.add_argument(
        "--folder",
        default=DEFAULT_MONITOR_DIR,
        help=f"Folder to scan. Default: {DEFAULT_MONITOR_DIR}",
    )
    ap.add_argument(
        "--manifest",
        default=DEFAULT_MANIFEST,
        help=f"JSON report. Default: {DEFAULT_MANIFEST}",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview files without deleting.",
    )
    ap.add_argument(
        "--delete-all-webp",
        action="store_true",
        help="Delete every WEBP even when a matching PNG is missing.",
    )
    args = ap.parse_args()

    root = Path(args.project_root).resolve()
    folder = (root / args.folder).resolve()
    manifest_path = (root / args.manifest).resolve()

    if not folder.exists():
        print(f"ERROR: Folder not found: {folder}", file=sys.stderr)
        return 2

    if not folder.is_dir():
        print(f"ERROR: Not a directory: {folder}", file=sys.stderr)
        return 2

    webp_files = sorted(
        (
            p
            for p in folder.rglob("*")
            if p.is_file() and p.suffix.lower() == ".webp"
        ),
        key=lambda p: str(p).lower(),
    )

    manifest = {
        "root": str(folder),
        "dryRun": bool(args.dry_run),
        "deleteAllWebp": bool(args.delete_all_webp),
        "webpFilesFound": len(webp_files),
        "startedAtUnix": time.time(),
        "files": [],
        "summary": {
            "deleted": 0,
            "wouldDelete": 0,
            "skippedNoMatchingPng": 0,
            "failed": 0,
            "bytesDeleted": 0,
        },
    }

    deleted = 0
    would_delete = 0
    skipped = 0
    failed = 0
    bytes_deleted = 0

    print(f"Scanning: {folder}")
    print(f"WEBP files found: {len(webp_files)}")
    print(
        "Mode: "
        + (
            "DELETE ALL WEBP"
            if args.delete_all_webp
            else "SAFE - only delete when same-name PNG exists"
        )
    )
    print(f"Dry run: {'YES' if args.dry_run else 'NO'}")
    print()

    for idx, webp in enumerate(webp_files, start=1):
        png = webp.with_suffix(".png")
        rel_webp = str(webp.relative_to(folder)).replace("\\", "/")
        rel_png = str(png.relative_to(folder)).replace("\\", "/")
        progress = f"[{idx}/{len(webp_files)}]"

        try:
            size = webp.stat().st_size
        except OSError:
            size = 0

        matching_png_ok = png.is_file() and png.stat().st_size > 0
        eligible = args.delete_all_webp or matching_png_ok

        rec = {
            "webp": rel_webp,
            "matchingPng": rel_png if matching_png_ok else None,
            "webpBytes": size,
            "status": None,
        }

        if not eligible:
            rec["status"] = "skipped-no-matching-png"
            skipped += 1
            print(f"{progress} SKIP no matching PNG: {rel_webp}")
            manifest["files"].append(rec)
            continue

        if args.dry_run:
            rec["status"] = "would-delete"
            would_delete += 1
            print(f"{progress} WOULD DELETE: {rel_webp}")
            manifest["files"].append(rec)
            continue

        try:
            webp.unlink()
            rec["status"] = "deleted"
            deleted += 1
            bytes_deleted += size
            print(f"{progress} DELETED: {rel_webp}")
        except Exception as exc:
            rec["status"] = "failed"
            rec["error"] = str(exc)
            failed += 1
            print(f"{progress} ERROR {rel_webp}: {exc}", file=sys.stderr)

        manifest["files"].append(rec)

        if idx % 250 == 0:
            manifest["summary"].update(
                {
                    "deleted": deleted,
                    "wouldDelete": would_delete,
                    "skippedNoMatchingPng": skipped,
                    "failed": failed,
                    "bytesDeleted": bytes_deleted,
                }
            )
            save_manifest(manifest_path, manifest)

    manifest["finishedAtUnix"] = time.time()
    manifest["summary"].update(
        {
            "deleted": deleted,
            "wouldDelete": would_delete,
            "skippedNoMatchingPng": skipped,
            "failed": failed,
            "bytesDeleted": bytes_deleted,
        }
    )
    save_manifest(manifest_path, manifest)

    print("\nDONE")
    print(f"WEBP found:              {len(webp_files)}")
    print(f"Deleted:                 {deleted}")
    print(f"Would delete (dry run):  {would_delete}")
    print(f"Skipped - no PNG:        {skipped}")
    print(f"Failed:                  {failed}")
    print(f"Bytes deleted:           {bytes_deleted:,}")
    print(f"Manifest:                {manifest_path}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
