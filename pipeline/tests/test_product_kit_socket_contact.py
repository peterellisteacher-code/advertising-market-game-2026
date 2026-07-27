from __future__ import annotations

import pytest
from PIL import Image, ImageDraw

from pipeline.product_kit.socket_contact import (
    SocketContactError,
    SocketRasterFragment,
    verify_socket_contact,
)


FRAME = {
    "originalWidth": 32,
    "originalHeight": 24,
    "trimX": 0,
    "trimY": 0,
    "trimWidth": 32,
    "trimHeight": 24,
}
IDENTITY = {"a": 1, "b": 0, "c": 0, "d": 1, "e": 0, "f": 0}


def _base() -> Image.Image:
    image = Image.new("RGBA", (32, 24), (0, 0, 0, 0))
    ImageDraw.Draw(image).rectangle((5, 12, 26, 21), fill=(255, 255, 255, 255))
    return image


def _bar(top: int, bottom: int = 11) -> Image.Image:
    image = Image.new("RGBA", (32, 24), (0, 0, 0, 0))
    ImageDraw.Draw(image).rectangle((11, top, 20, bottom), fill=(255, 255, 255, 255))
    return image


def _fragment(image: Image.Image, layer: str = "rear") -> SocketRasterFragment:
    return SocketRasterFragment(
        layer=layer,
        image=image,
        frame=FRAME,
        normalized_transform=IDENTITY,
    )


def test_detects_direct_base_component_contact() -> None:
    result = verify_socket_contact(
        "pk1-cert-direct",
        _base(),
        FRAME,
        [_fragment(_bar(5))],
    )

    assert result.certification_id == "pk1-cert-direct"
    assert result.overlap_pixels == 0
    assert result.gap_pixels == 0
    assert result.maximum_gap_pixels == 2
    assert result.detached_components == 0


def test_accepts_a_two_output_pixel_antialias_gap() -> None:
    result = verify_socket_contact(
        "pk1-cert-antialias-gap",
        _base(),
        FRAME,
        [_fragment(_bar(3, 9))],
    )

    assert result.gap_pixels == 2
    assert result.detached_components == 0


def test_rejects_a_floating_handle_and_reports_measured_residuals() -> None:
    with pytest.raises(SocketContactError) as captured:
        verify_socket_contact(
            "pk1-cert-floating",
            _base(),
            FRAME,
            [_fragment(_bar(1, 5))],
        )

    assert captured.value.result.certification_id == "pk1-cert-floating"
    assert captured.value.result.gap_pixels == 6
    assert captured.value.result.detached_components == 1
    assert "pk1-cert-floating" in str(captured.value)
    assert "gap_pixels=6" in str(captured.value)


def test_rejects_overlap_deeper_than_the_allowed_attachment_band() -> None:
    with pytest.raises(SocketContactError) as captured:
        verify_socket_contact(
            "pk1-cert-excessive-overlap",
            _base(),
            FRAME,
            [_fragment(_bar(5, 18), "front")],
            maximum_attachment_band_pixels=2,
        )

    assert captured.value.result.overlap_pixels > 0
    assert "overlap_depth_pixels" in str(captured.value)


def test_rejects_one_floating_mount_even_when_the_other_mount_touches() -> None:
    handle = Image.new("RGBA", (32, 24), (0, 0, 0, 0))
    draw = ImageDraw.Draw(handle)
    draw.rectangle((6, 2, 25, 3), fill=(255, 255, 255, 255))
    draw.rectangle((6, 3, 10, 8), fill=(255, 255, 255, 255))
    draw.rectangle((23, 3, 25, 11), fill=(255, 255, 255, 255))

    with pytest.raises(SocketContactError) as captured:
        verify_socket_contact(
            "pk1-cert-two-mount-handle",
            _base(),
            FRAME,
            [
                SocketRasterFragment(
                    layer="rear",
                    image=handle,
                    frame=FRAME,
                    normalized_transform=IDENTITY,
                    target_point={"x": 0.5, "y": 11 / 24},
                    target_normal={"x": 0, "y": 1},
                )
            ],
            attachment_search_band_pixels=3,
        )

    assert captured.value.result.gap_pixels == 3
    assert captured.value.result.detached_components == 1


@pytest.mark.parametrize("layer", ["front", "rear"])
def test_evaluates_front_and_rear_fragments_after_the_actual_transform(
    layer: str,
) -> None:
    translated = {
        "a": 1,
        "b": 0,
        "c": 0,
        "d": 1,
        "e": 0,
        "f": 3 / 24,
    }
    result = verify_socket_contact(
        f"pk1-cert-{layer}",
        _base(),
        FRAME,
        [
            SocketRasterFragment(
                layer=layer,
                image=_bar(2, 8),
                frame=FRAME,
                normalized_transform=translated,
            )
        ],
    )

    assert result.gap_pixels == 0
    assert result.detached_components == 0
