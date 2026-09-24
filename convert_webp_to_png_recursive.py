#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

from PIL import Image


def fmt_bytes(n: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(n)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{n} B"


def save_manifest(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def convert_one(src: Path, dest: Path, overwrite: bool) -> tuple[str, int]:
    """
    Returns:
        (status, output_size)
    status: converted | skipped-existing
    """
    if dest.exists() and not overwrite:
        return "skipped-existing", dest.stat().st_size

    dest.parent.mkdir(parents=True, exist_ok=True)
    temp = dest.with_name(dest.name + ".part")

    try:
        with Image.open(src) as im:
            # Preserve transparency where possible.
            if im.mode in ("RGBA", "LA"):
                out = im.convert("RGBA")
            elif im.mode == "P":
                if "transparency" in im.info:
                    out = im.convert("RGBA")
                else:
                    out = im.convert("RGB")
            else:
                out = im.convert("RGB")

            out.save(temp, format="PNG", optimize=False)

        if not temp.exists() or temp.stat().st_size <= 0:
            raise RuntimeError("PNG output is empty")

        if dest.exists() and overwrite:
            dest.unlink()

        temp.replace(dest)
        return "converted", dest.stat().st_size

    finally:
        temp.unlink(missing_ok=True)


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser(
        description="Recursively convert all WEBP files under a folder to PNG."
    )
    ap.add_argument(
        "--root",
        default="public/images/products/monitor",
        help="Root folder to scan recursively.",
    )
    ap.add_argument(
        "--manifest",
        default="webp_to_png_conversion_manifest.json",
        help="Manifest JSON path.",
    )
    ap.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Process first N WEBP files only; 0 = all.",
    )
    ap.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing PNG files.",
    )
    ap.add_argument(
        "--delete-source",
        action="store_true",
        help="Delete each WEBP only after PNG conversion succeeds.",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Show files that would be converted without changing anything.",
    )
    ap.add_argument(
        "--follow-symlinks",
        action="store_true",
        help="Follow directory symlinks while scanning.",
    )
    args = ap.parse_args()

    if args.limit < 0:
        ap.error("--limit cannot be negative")

    root = Path(args.root).resolve()
    manifest_path = Path(args.manifest).resolve()

    if not root.exists():
        print(f"ERROR: Root folder not found: {root}", file=sys.stderr)
        return 2

    if not root.is_dir():
        print(f"ERROR: Root path is not a directory: {root}", file=sys.stderr)
        return 2

    print(f"Scanning recursively: {root}")
    print("Finding .webp files...")

    webp_files = []

    if args.follow_symlinks:
        for current_root, dirs, files in os.walk(root, followlinks=True):
            current = Path(current_root)
            for name in files:
                if name.lower().endswith(".webp"):
                    webp_files.append(current / name)
    else:
        webp_files = [
            p for p in root.rglob("*")
            if p.is_file() and p.suffix.lower() == ".webp"
        ]

    webp_files.sort(key=lambda p: str(p).lower())

    total_found = len(webp_files)

    if args.limit:
        webp_files = webp_files[: args.limit]

    print(f"WEBP files found:      {total_found}")
    print(f"Selected this run:     {len(webp_files)}")
    print(f"Overwrite PNG:         {'YES' if args.overwrite else 'NO'}")
    print(f"Delete source WEBP:    {'YES' if args.delete_source else 'NO'}")
    print(f"Dry run:               {'YES' if args.dry_run else 'NO'}")
    print()

    manifest = {
        "root": str(root),
        "totalWebpFilesFound": total_found,
        "selectedForThisRun": len(webp_files),
        "overwrite": bool(args.overwrite),
        "deleteSource": bool(args.delete_source),
        "dryRun": bool(args.dry_run),
        "startedAtUnix": time.time(),
        "files": [],
        "summary": {
            "converted": 0,
            "skippedExisting": 0,
            "failed": 0,
            "deletedSource": 0,
            "inputBytesProcessed": 0,
            "outputBytesWritten": 0,
        },
    }

    converted = 0
    skipped = 0
    failed = 0
    deleted = 0
    input_bytes = 0
    output_bytes = 0

    start = time.time()

    for idx, src in enumerate(webp_files, start=1):
        dest = src.with_suffix(".png")
        rel_src = src.relative_to(root)
        rel_dest = dest.relative_to(root)

        try:
            src_size = src.stat().st_size
        except OSError:
            src_size = 0

        input_bytes += src_size

        rec = {
            "source": str(rel_src).replace("\\", "/"),
            "destination": str(rel_dest).replace("\\", "/"),
            "sourceBytes": src_size,
            "outputBytes": 0,
            "status": None,
        }

        progress = f"[{idx}/{len(webp_files)}]"

        if args.dry_run:
            rec["status"] = "dry-run"
            print(f"{progress} MAP  {rec['source']} -> {rec['destination']}")
            manifest["files"].append(rec)
            continue

        try:
            status, out_size = convert_one(src, dest, args.overwrite)
            rec["status"] = status
            rec["outputBytes"] = out_size

            if status == "converted":
                converted += 1
                output_bytes += out_size

                if args.delete_source:
                    src.unlink()
                    deleted += 1
                    rec["sourceDeleted"] = True
                else:
                    rec["sourceDeleted"] = False

                print(f"{progress} OK   {rec['source']} -> {rec['destination']}")

            else:
                skipped += 1
                output_bytes += out_size
                rec["sourceDeleted"] = False
                print(f"{progress} SKIP existing PNG: {rec['destination']}")

        except Exception as exc:
            failed += 1
            rec["status"] = "failed"
            rec["error"] = str(exc)
            rec["sourceDeleted"] = False
            print(f"{progress} ERR  {rec['source']}: {exc}", file=sys.stderr)

        manifest["files"].append(rec)
        manifest["summary"].update({
            "converted": converted,
            "skippedExisting": skipped,
            "failed": failed,
            "deletedSource": deleted,
            "inputBytesProcessed": input_bytes,
            "outputBytesWritten": output_bytes,
        })

        # Persist progress every 100 files and on the final file.
        if idx % 100 == 0 or idx == len(webp_files):
            save_manifest(manifest_path, manifest)

    elapsed = time.time() - start

    manifest["finishedAtUnix"] = time.time()
    manifest["elapsedSeconds"] = elapsed
    manifest["summary"].update({
        "converted": converted,
        "skippedExisting": skipped,
        "failed": failed,
        "deletedSource": deleted,
        "inputBytesProcessed": input_bytes,
        "outputBytesWritten": output_bytes,
    })

    save_manifest(manifest_path, manifest)

    print("\nDONE")
    print(f"WEBP found:            {total_found}")
    print(f"Processed this run:    {len(webp_files)}")
    print(f"Converted:             {converted}")
    print(f"Skipped existing PNG:  {skipped}")
    print(f"Failed:                {failed}")
    print(f"Source WEBP deleted:   {deleted}")
    print(f"Input size processed:  {fmt_bytes(input_bytes)}")
    print(f"PNG size written:      {fmt_bytes(output_bytes)}")
    print(f"Elapsed:               {elapsed:.1f} sec")
    print(f"Manifest:              {manifest_path}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
