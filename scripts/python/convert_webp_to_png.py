#!/usr/bin/env python3
"""
Recursively convert every .webp image under a root folder to .png
and then automatically delete the original .webp ONLY after the PNG
has been successfully created and verified.

Default root:
    public/images/products/monitor

This is recursive, so all subfolders and child folders are included.

Behavior:
- image.webp -> image.png
- keeps the same folder
- if PNG does not exist: convert WEBP -> PNG, verify PNG, then delete WEBP
- if PNG already exists and is valid: delete the duplicate WEBP
- if conversion fails: KEEP the original WEBP
- if existing PNG is invalid/empty: reconvert it from WEBP
- writes a JSON manifest
- supports --dry-run and --limit
- supports any root folder you pass via --root

Install:
    python -m pip install pillow

Examples:
    # Preview only
    python convert_webp_to_png_and_delete.py --root public/images/products/monitor --dry-run

    # Test first 20
    python convert_webp_to_png_and_delete.py --root public/images/products/monitor --limit 20

    # Convert all and automatically delete WEBP
    python convert_webp_to_png_and_delete.py --root public/images/products/monitor

    # Use another folder later
    python convert_webp_to_png_and_delete.py --root public/images/products

    # Force recreate existing PNG from WEBP
    python convert_webp_to_png_and_delete.py --root public/images/products/monitor --overwrite
"""

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
        json.dumps(
            payload,
            indent=2,
            ensure_ascii=False,
        ) + "\n",
        encoding="utf-8",
    )


def verify_png(path: Path) -> bool:
    """
    Verify that a PNG exists, is non-empty, and Pillow can fully read it.
    """
    if not path.is_file():
        return False

    if path.stat().st_size <= 0:
        return False

    try:
        with Image.open(path) as im:
            if im.format != "PNG":
                return False
            im.verify()
        return True
    except Exception:
        return False


def convert_webp_to_png(
    src: Path,
    dest: Path,
    overwrite: bool,
) -> tuple[str, int]:
    """
    Returns:
        (status, output_size)

    status:
        converted
        existing-valid-png
    """

    if dest.exists() and not overwrite:
        if verify_png(dest):
            return "existing-valid-png", dest.stat().st_size

    dest.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    temp = dest.with_name(
        dest.name + ".part"
    )

    try:
        with Image.open(src) as im:
            # Fully load before deleting original later.
            im.load()

            if im.mode in ("RGBA", "LA"):
                out = im.convert("RGBA")

            elif im.mode == "P":
                if "transparency" in im.info:
                    out = im.convert("RGBA")
                else:
                    out = im.convert("RGB")

            else:
                out = im.convert("RGB")

            out.save(
                temp,
                format="PNG",
                optimize=False,
            )

        if (
            not temp.exists()
            or temp.stat().st_size <= 0
        ):
            raise RuntimeError(
                "PNG output is empty"
            )

        # Verify temporary PNG before replacing final file.
        try:
            with Image.open(temp) as check:
                if check.format != "PNG":
                    raise RuntimeError(
                        "Converted output is not PNG"
                    )
                check.verify()
        except Exception as exc:
            raise RuntimeError(
                f"PNG verification failed: {exc}"
            ) from exc

        if dest.exists():
            dest.unlink()

        temp.replace(dest)

        # Verify final file again.
        if not verify_png(dest):
            raise RuntimeError(
                "Final PNG verification failed"
            )

        return (
            "converted",
            dest.stat().st_size,
        )

    finally:
        temp.unlink(
            missing_ok=True
        )


def main() -> int:
    for stream in (
        sys.stdout,
        sys.stderr,
    ):
        if hasattr(
            stream,
            "reconfigure",
        ):
            stream.reconfigure(
                encoding="utf-8"
            )

    parser = argparse.ArgumentParser(
        description=(
            "Recursively convert WEBP to PNG "
            "and delete WEBP only after successful verification."
        )
    )

    parser.add_argument(
        "--root",
        default="public/images/products/monitor",
        help=(
            "Root folder to scan recursively. "
            "Default: public/images/products/monitor"
        ),
    )

    parser.add_argument(
        "--manifest",
        default="webp_to_png_and_delete_manifest.json",
        help="JSON conversion report.",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help=(
            "Process first N WEBP files only. "
            "0 means all."
        ),
    )

    parser.add_argument(
        "--overwrite",
        action="store_true",
        help=(
            "Recreate PNG even if a valid PNG already exists."
        ),
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Show actions without converting or deleting anything."
        ),
    )

    parser.add_argument(
        "--follow-symlinks",
        action="store_true",
        help=(
            "Follow directory symlinks while scanning."
        ),
    )

    args = parser.parse_args()

    if args.limit < 0:
        parser.error(
            "--limit cannot be negative"
        )

    root = Path(
        args.root
    ).resolve()

    manifest_path = Path(
        args.manifest
    ).resolve()

    if not root.exists():
        print(
            f"ERROR: Root folder not found: {root}",
            file=sys.stderr,
        )
        return 2

    if not root.is_dir():
        print(
            f"ERROR: Root path is not a directory: {root}",
            file=sys.stderr,
        )
        return 2

    print(
        f"Scanning recursively: {root}"
    )
    print(
        "Finding .webp files..."
    )

    if args.follow_symlinks:
        webp_files: list[Path] = []

        for current_root, dirs, files in os.walk(
            root,
            followlinks=True,
        ):
            current = Path(
                current_root
            )

            for name in files:
                if name.lower().endswith(
                    ".webp"
                ):
                    webp_files.append(
                        current / name
                    )

    else:
        webp_files = [
            path
            for path in root.rglob("*")
            if (
                path.is_file()
                and path.suffix.lower()
                == ".webp"
            )
        ]

    webp_files.sort(
        key=lambda p: str(p).lower()
    )

    total_found = len(
        webp_files
    )

    if args.limit:
        webp_files = webp_files[
            : args.limit
        ]

    print(
        f"WEBP files found:      "
        f"{total_found}"
    )
    print(
        f"Selected this run:     "
        f"{len(webp_files)}"
    )
    print(
        f"Overwrite PNG:         "
        f"{'YES' if args.overwrite else 'NO'}"
    )
    print(
        f"Auto-delete WEBP:      YES"
    )
    print(
        f"Dry run:               "
        f"{'YES' if args.dry_run else 'NO'}"
    )
    print()

    manifest = {
        "root": str(root),
        "totalWebpFilesFound": total_found,
        "selectedForThisRun": len(
            webp_files
        ),
        "overwrite": bool(
            args.overwrite
        ),
        "autoDeleteSource": True,
        "dryRun": bool(
            args.dry_run
        ),
        "startedAtUnix": time.time(),
        "files": [],
        "summary": {
            "converted": 0,
            "existingPngUsed": 0,
            "deletedSource": 0,
            "failed": 0,
            "inputBytesProcessed": 0,
            "outputBytesPresent": 0,
            "bytesFreedByDeletingWebp": 0,
        },
    }

    converted = 0
    existing_png = 0
    deleted = 0
    failed = 0
    input_bytes = 0
    output_bytes = 0
    bytes_freed = 0

    start = time.time()

    for idx, src in enumerate(
        webp_files,
        start=1,
    ):
        dest = src.with_suffix(
            ".png"
        )

        rel_src = src.relative_to(
            root
        )

        rel_dest = dest.relative_to(
            root
        )

        progress = (
            f"[{idx}/"
            f"{len(webp_files)}]"
        )

        try:
            src_size = src.stat().st_size
        except OSError:
            src_size = 0

        input_bytes += src_size

        rec = {
            "source": str(
                rel_src
            ).replace("\\", "/"),
            "destination": str(
                rel_dest
            ).replace("\\", "/"),
            "sourceBytes": src_size,
            "outputBytes": 0,
            "status": None,
            "sourceDeleted": False,
        }

        if args.dry_run:
            if (
                dest.exists()
                and verify_png(dest)
                and not args.overwrite
            ):
                rec[
                    "status"
                ] = (
                    "would-delete-webp-"
                    "existing-valid-png"
                )

                print(
                    f"{progress} WOULD DELETE WEBP "
                    f"(PNG exists): "
                    f"{rec['source']}"
                )

            else:
                rec[
                    "status"
                ] = (
                    "would-convert-and-delete"
                )

                print(
                    f"{progress} WOULD CONVERT + DELETE: "
                    f"{rec['source']} -> "
                    f"{rec['destination']}"
                )

            manifest[
                "files"
            ].append(rec)

            continue

        try:
            status, out_size = (
                convert_webp_to_png(
                    src,
                    dest,
                    args.overwrite,
                )
            )

            rec[
                "outputBytes"
            ] = out_size

            output_bytes += out_size

            if status == "converted":
                converted += 1

                print(
                    f"{progress} CONVERTED "
                    f"{rec['source']} -> "
                    f"{rec['destination']}"
                )

            elif (
                status
                == "existing-valid-png"
            ):
                existing_png += 1

                print(
                    f"{progress} PNG EXISTS "
                    f"{rec['destination']}"
                )

            # Critical safety:
            # only delete WEBP after a valid PNG is confirmed.
            if not verify_png(dest):
                raise RuntimeError(
                    "PNG is not valid; WEBP was not deleted"
                )

            src.unlink()

            deleted += 1
            bytes_freed += src_size

            rec[
                "sourceDeleted"
            ] = True

            rec[
                "status"
            ] = (
                "converted-and-source-deleted"
                if status == "converted"
                else "existing-png-source-deleted"
            )

            print(
                f"{progress} DELETED WEBP: "
                f"{rec['source']}"
            )

        except Exception as exc:
            failed += 1

            rec[
                "status"
            ] = "failed"

            rec[
                "error"
            ] = str(exc)

            rec[
                "sourceDeleted"
            ] = False

            print(
                f"{progress} ERR  "
                f"{rec['source']}: "
                f"{exc}",
                file=sys.stderr,
            )

        manifest[
            "files"
        ].append(rec)

        manifest[
            "summary"
        ].update({
            "converted": converted,
            "existingPngUsed": existing_png,
            "deletedSource": deleted,
            "failed": failed,
            "inputBytesProcessed": input_bytes,
            "outputBytesPresent": output_bytes,
            "bytesFreedByDeletingWebp": bytes_freed,
        })

        # Save progress every 100 files
        # so large 25k+ runs remain recoverable.
        if (
            idx % 100 == 0
            or idx == len(webp_files)
        ):
            save_manifest(
                manifest_path,
                manifest,
            )

    elapsed = time.time() - start

    manifest[
        "finishedAtUnix"
    ] = time.time()

    manifest[
        "elapsedSeconds"
    ] = elapsed

    manifest[
        "summary"
    ].update({
        "converted": converted,
        "existingPngUsed": existing_png,
        "deletedSource": deleted,
        "failed": failed,
        "inputBytesProcessed": input_bytes,
        "outputBytesPresent": output_bytes,
        "bytesFreedByDeletingWebp": bytes_freed,
    })

    save_manifest(
        manifest_path,
        manifest,
    )

    print("\nDONE")
    print(
        f"WEBP found:             "
        f"{total_found}"
    )
    print(
        f"Processed this run:     "
        f"{len(webp_files)}"
    )
    print(
        f"Converted to PNG:       "
        f"{converted}"
    )
    print(
        f"Existing valid PNG:     "
        f"{existing_png}"
    )
    print(
        f"WEBP deleted:           "
        f"{deleted}"
    )
    print(
        f"Failed:                 "
        f"{failed}"
    )
    print(
        f"Input WEBP size:        "
        f"{fmt_bytes(input_bytes)}"
    )
    print(
        f"PNG size present:       "
        f"{fmt_bytes(output_bytes)}"
    )
    print(
        f"WEBP disk freed:        "
        f"{fmt_bytes(bytes_freed)}"
    )
    print(
        f"Elapsed:                "
        f"{elapsed:.1f} sec"
    )
    print(
        f"Manifest:               "
        f"{manifest_path}"
    )

    if failed:
        print(
            "\nIMPORTANT: Failed files were NOT deleted."
        )

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
