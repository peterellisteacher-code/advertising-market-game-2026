from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "pipeline"))

from asset_pipeline.starter_fill_certification import (  # noqa: E402
    BoundedLineworkProfile,
    certify_connected_sections,
    certify_opaque_body,
)


def _load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def verify(catalog_path: Path, starters_path: Path) -> list[tuple[str, int]]:
    catalogue = _load_json(catalog_path)
    manifest = _load_json(starters_path)
    if not isinstance(catalogue, list) or not isinstance(manifest, dict):
        raise ValueError("catalogue or starter manifest has the wrong top-level shape")
    records = {
        record.get("id"): record
        for record in catalogue
        if isinstance(record, dict) and isinstance(record.get("id"), str)
    }
    profiles = manifest.get("fillProfiles")
    starters = manifest.get("starters")
    if not isinstance(profiles, dict) or not isinstance(starters, list):
        raise ValueError("starter fill profiles or records are missing")
    bounded = profiles.get("bounded-linework-v1")
    opaque = profiles.get("opaque-body-v1")
    if not isinstance(bounded, dict) or not isinstance(opaque, dict):
        raise ValueError("starter fill profile is missing")
    profile = BoundedLineworkProfile(
        line_darkness_threshold=int(bounded["lineDarknessThreshold"]),
        minimum_alpha=int(bounded["minimumAlpha"]),
        colour_distance=int(bounded["colourDistance"]),
        minimum_region_pixels=int(bounded["minimumRegionPixels"]),
        maximum_region_fraction=float(bounded["maximumRegionFraction"]),
    )
    results: list[tuple[str, int]] = []
    for starter in starters:
        if not isinstance(starter, dict) or starter.get("kind") != "raster":
            continue
        asset_id = starter.get("assetId")
        record = records.get(asset_id)
        if not isinstance(asset_id, str) or not isinstance(record, dict):
            raise ValueError(f"starter {starter.get('id')} has no catalogue record")
        expected_path = f"/catalog/generated/offline-core-v1/assets/{asset_id}/master.png"
        if record.get("files", {}).get("master") != expected_path:
            raise ValueError(f"{asset_id} master path is not canonical")
        master_path = REPO_ROOT.joinpath(*expected_path.removeprefix("/").split("/"))
        if not master_path.is_file():
            raise ValueError(f"{asset_id} master file is missing")
        digest = hashlib.sha256(master_path.read_bytes()).hexdigest()
        if digest != record.get("masterSha256"):
            raise ValueError(f"{asset_id} master hash does not match the catalogue")
        with Image.open(master_path) as image:
            if starter.get("fillMode") == "connected-sections":
                result = certify_connected_sections(image, profile)
                if result.status != "certified":
                    raise ValueError(f"{asset_id} has fewer than two bounded fill regions")
                results.append((asset_id, len(result.regions)))
            elif starter.get("fillMode") == "whole-object":
                result = certify_opaque_body(image, minimum_alpha=int(opaque["minimumAlpha"]))
                if result.status != "certified":
                    raise ValueError(f"{asset_id} has no opaque recolourable body")
                results.append((asset_id, 1))
            else:
                raise ValueError(f"{asset_id} has no recorded fill certification")
    if len(results) != 9:
        raise ValueError(f"expected nine raster starters, found {len(results)}")
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--starters", required=True, type=Path)
    args = parser.parse_args()
    results = verify(args.catalog.resolve(), args.starters.resolve())
    details = " ".join(f"{asset_id}:{count}" for asset_id, count in results)
    print(f"STARTER_FILL_CERTIFICATION_OK rasters=9 {details}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
