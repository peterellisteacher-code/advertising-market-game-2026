from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import pytest
from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[2]


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def tree_digest(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(candidate for candidate in root.rglob("*") if candidate.is_file()):
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


@pytest.fixture
def valid_asset_dict() -> dict[str, Any]:
    base = "/catalog/generated/offline-core-v1/assets/bottle-basic"
    return {
        "schema": "catalog-asset@1",
        "delivery": "offline",
        "id": "bottle-basic",
        "version": 1,
        "kind": "raster-master",
        "title": "Basic bottle",
        "category": "drinkware",
        "tags": ["bottle", "drinkware"],
        "files": {
            "thumbnail": f"{base}/thumbnail-192.webp",
            "preview": f"{base}/preview-640.webp",
            "master": f"{base}/master.png",
            "masks": {"body": f"{base}/masks/body.png"},
        },
        "masterSha256": "a" * 64,
        "dimensions": {"width": 320, "height": 640},
        "recolourZones": ["body"],
        "anchors": [{"id": "lid", "x": 0.5, "y": 0.1, "accepts": ["cap"]}],
        "materialProfiles": ["matte-plastic"],
        "classroomReviewed": False,
        "brandFree": False,
        "attribution": {
            "creator": "Pipeline fixture",
            "sourceUrl": "local",
            "license": "Classroom fixture",
        },
        "defaultZoneStyles": {
            "body": {"colour": "#3366CC", "materialId": "matte-plastic", "opacity": 1.0}
        },
    }


def write_rgba(path: Path, size: tuple[int, int], colour=(255, 0, 0, 255)) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGBA", size, colour).save(path)
    return path
