from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from pipeline.product_kit.socket_contact import (  # noqa: E402
    SocketContactError,
    verify_product_kit_catalogue_contacts,
)


def _load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--kit", required=True, type=Path)
    args = parser.parse_args()
    try:
        results = verify_product_kit_catalogue_contacts(
            _load_json(args.catalog.resolve()),
            _load_json(args.kit.resolve()),
            REPO_ROOT,
        )
    except (OSError, ValueError, SocketContactError) as error:
        print(f"PRODUCT_KIT_SOCKET_CONTACT_FAIL {error}", file=sys.stderr)
        return 1
    maximum_gap = max(
        (result.maximum_gap_pixels for result in results),
        default=0,
    )
    print(
        "PRODUCT_KIT_SOCKET_CONTACT_OK "
        f"certifications={len(results)} "
        f"maximum_gap_pixels={maximum_gap}"
    )
    for result in results:
        print(
            f"{result.certification_id} "
            f"gap_pixels={result.gap_pixels} "
            f"overlap_pixels={result.overlap_pixels} "
            f"detached_components={result.detached_components}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
