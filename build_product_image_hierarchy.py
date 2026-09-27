#!/usr/bin/env python3
"""
Build seed-ready hierarchical image JSON from public/images/products

Output hierarchy:
Category -> Subcategory -> Brand -> Images

Example:
{
  "categories": [
    {
      "name": "Networking",
      "slug": "networking",
      "imagePath": "/images/products/networking",
      "subcategories": [
        {
          "name": "Access Point",
          "slug": "access-point",
          "imagePath": "/images/products/networking/access-point",
          "brands": [
            {
              "name": "TP Link",
              "slug": "tp-link",
              "imagePath": "/images/products/networking/access-point/tp-link",
              "images": [
                "/images/products/networking/access-point/tp-link/product-1.png",
                "/images/products/networking/access-point/tp-link/product-2.png"
              ]
            }
          ]
        }
      ]
    }
  ]
}

Usage:
    python build_product_image_hierarchy.py

Custom project root:
    python build_product_image_hierarchy.py --project-root .

Custom input folder:
    python build_product_image_hierarchy.py \
        --input public/images/products

Custom output:
    python build_product_image_hierarchy.py \
        --output product_image_hierarchy.json
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".avif",
    ".gif",
}

SPECIAL_FOLDERS = {
    "_direct",
    "_other",
    "_uncategorized",
}


def slugify(value: str) -> str:
    value = (value or "").strip()
    value = value.replace("&", " and ")
    value = re.sub(r"\s+", "-", value)
    value = re.sub(r"[^a-zA-Z0-9\-]+", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-").lower() or "unknown"


def pretty_name(value: str) -> str:
    special = {
        "ac": "AC",
        "ai": "AI",
        "ssd": "SSD",
        "hdd": "HDD",
        "ram": "RAM",
        "ups": "UPS",
        "ips": "IPS",
        "onu": "ONU",
        "olt": "OLT",
        "ip": "IP",
        "pc": "PC",
        "tv": "TV",
        "vr": "VR",
        "gpu": "GPU",
        "nas": "NAS",
        "san": "SAN",
        "kvm": "KVM",
        "dvr": "DVR",
        "nvr": "NVR",
        "xvr": "XVR",
        "poe": "PoE",
        "wifi": "WiFi",
        "usb": "USB",
        "lan": "LAN",
    }

    words = re.split(r"[-_\s]+", str(value).strip())

    out = []

    for word in words:
        if not word:
            continue

        low = word.lower()

        if low in special:
            out.append(special[low])
        else:
            out.append(
                word[:1].upper() + word[1:]
            )

    return " ".join(out)


def web_path(path: Path, public_root: Path) -> str:
    """
    Convert:
        public/images/products/networking/router/foo.png

    into:
        /images/products/networking/router/foo.png
    """
    relative = path.relative_to(public_root)

    return "/" + relative.as_posix()


def images_in_folder(folder: Path) -> list[Path]:
    """
    Only images directly inside this folder.
    Does not descend into child folders.
    """
    images = []

    for item in folder.iterdir():
        if (
            item.is_file()
            and item.suffix.lower() in IMAGE_EXTENSIONS
        ):
            images.append(item)

    return sorted(
        images,
        key=lambda p: p.name.casefold(),
    )


def child_folders(folder: Path) -> list[Path]:
    return sorted(
        [
            p
            for p in folder.iterdir()
            if p.is_dir()
        ],
        key=lambda p: p.name.casefold(),
    )


def build_leaf_record(
    folder: Path,
    public_root: Path,
):
    imgs = images_in_folder(folder)

    return {
        "name": pretty_name(folder.name),
        "slug": slugify(folder.name),
        "folder": folder.name,
        "imagePath": web_path(
            folder,
            public_root,
        ),
        "images": [
            web_path(
                img,
                public_root,
            )
            for img in imgs
        ],
        "imageCount": len(imgs),
    }


def build_subcategory_record(
    subcategory_dir: Path,
    public_root: Path,
):
    child_dirs = child_folders(
        subcategory_dir
    )

    direct_images = images_in_folder(
        subcategory_dir
    )

    brands = []
    special_folders = []

    for child in child_dirs:
        leaf = build_leaf_record(
            child,
            public_root,
        )

        if child.name in SPECIAL_FOLDERS:
            special_folders.append(
                leaf
            )
        else:
            brands.append(
                leaf
            )

    return {
        "name": pretty_name(
            subcategory_dir.name
        ),
        "slug": slugify(
            subcategory_dir.name
        ),
        "folder": subcategory_dir.name,
        "imagePath": web_path(
            subcategory_dir,
            public_root,
        ),
        "directImages": [
            web_path(
                img,
                public_root,
            )
            for img in direct_images
        ],
        "directImageCount": len(
            direct_images
        ),
        "brands": brands,
        "specialFolders": special_folders,
    }


def build_category_record(
    category_dir: Path,
    public_root: Path,
):
    subcategories = []
    direct_images = images_in_folder(
        category_dir
    )

    for child in child_folders(
        category_dir
    ):
        subcategories.append(
            build_subcategory_record(
                child,
                public_root,
            )
        )

    return {
        "name": pretty_name(
            category_dir.name
        ),
        "slug": slugify(
            category_dir.name
        ),
        "folder": category_dir.name,
        "imagePath": web_path(
            category_dir,
            public_root,
        ),
        "directImages": [
            web_path(
                img,
                public_root,
            )
            for img in direct_images
        ],
        "directImageCount": len(
            direct_images
        ),
        "subcategories": subcategories,
    }


def collect_stats(
    categories: list[dict],
):
    total_categories = len(categories)
    total_subcategories = 0
    total_brands = 0
    total_images = 0
    total_special_folders = 0

    for category in categories:
        total_images += category[
            "directImageCount"
        ]

        for sub in category[
            "subcategories"
        ]:
            total_subcategories += 1
            total_images += sub[
                "directImageCount"
            ]

            total_brands += len(
                sub["brands"]
            )

            total_special_folders += len(
                sub["specialFolders"]
            )

            for brand in sub["brands"]:
                total_images += brand[
                    "imageCount"
                ]

            for special in sub[
                "specialFolders"
            ]:
                total_images += special[
                    "imageCount"
                ]

    return {
        "categories": total_categories,
        "subcategories": total_subcategories,
        "brands": total_brands,
        "specialFolders": total_special_folders,
        "images": total_images,
    }


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Build Category -> Subcategory -> Brand -> Image "
            "hierarchy JSON from public/images/products"
        )
    )

    parser.add_argument(
        "--project-root",
        default=".",
        help="Project root. Default: current folder",
    )

    parser.add_argument(
        "--input",
        default="public/images/products",
        help=(
            "Product image root relative to project root. "
            "Default: public/images/products"
        ),
    )

    parser.add_argument(
        "--output",
        default="product_image_hierarchy.json",
        help=(
            "Output JSON relative to project root. "
            "Default: product_image_hierarchy.json"
        ),
    )

    parser.add_argument(
        "--compact",
        action="store_true",
        help="Write compact JSON instead of pretty JSON.",
    )

    args = parser.parse_args()

    project_root = Path(
        args.project_root
    ).resolve()

    products_root = (
        project_root / args.input
    ).resolve()

    output_path = (
        project_root / args.output
    ).resolve()

    public_root = (
        project_root / "public"
    ).resolve()

    if not products_root.exists():
        raise SystemExit(
            f"Input folder does not exist: {products_root}"
        )

    if not products_root.is_dir():
        raise SystemExit(
            f"Input path is not a directory: {products_root}"
        )

    if not public_root.exists():
        raise SystemExit(
            f"public folder not found: {public_root}"
        )

    try:
        products_root.relative_to(
            public_root
        )
    except ValueError:
        raise SystemExit(
            "Input folder must be inside the project's public folder "
            "so valid web paths can be generated."
        )

    category_dirs = child_folders(
        products_root
    )

    categories = []

    for category_dir in category_dirs:
        print(
            f"Scanning category: "
            f"{category_dir.name}"
        )

        categories.append(
            build_category_record(
                category_dir,
                public_root,
            )
        )

    stats = collect_stats(
        categories
    )

    payload = {
        "schemaVersion": 1,
        "sourceRoot": web_path(
            products_root,
            public_root,
        ),
        "physicalSourceRoot": (
            products_root.relative_to(
                project_root
            ).as_posix()
        ),
        "stats": stats,
        "categories": categories,
    }

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if args.compact:
        output_text = json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    else:
        output_text = json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
        )

    output_path.write_text(
        output_text + "\n",
        encoding="utf-8",
    )

    print()
    print("=" * 70)
    print("DONE")
    print("=" * 70)
    print(
        f"Categories    : "
        f"{stats['categories']}"
    )
    print(
        f"Subcategories : "
        f"{stats['subcategories']}"
    )
    print(
        f"Brands        : "
        f"{stats['brands']}"
    )
    print(
        f"Images        : "
        f"{stats['images']}"
    )
    print(
        f"Output        : "
        f"{output_path}"
    )
    print()
    print(
        "Image paths are web-ready, e.g."
    )
    print(
        "/images/products/networking/access-point/tp-link/product.png"
    )


if __name__ == "__main__":
    main()
