from __future__ import annotations

from PIL import Image, ImageDraw

from asset_pipeline.starter_fill_certification import (
    BoundedLineworkProfile,
    certify_connected_sections,
    certify_opaque_body,
)


PROFILE = BoundedLineworkProfile(
    line_darkness_threshold=220,
    minimum_alpha=200,
    colour_distance=48,
    minimum_region_pixels=20,
    maximum_region_fraction=0.95,
)


def _closed_two_section_fixture() -> Image.Image:
    image = Image.new("RGBA", (32, 24), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((3, 3, 28, 20), fill="white", outline="#202830", width=2)
    draw.line((16, 4, 16, 19), fill="#202830", width=2)
    return image


def test_certifies_two_bounded_regions_without_accepting_the_exterior() -> None:
    result = certify_connected_sections(_closed_two_section_fixture(), PROFILE)

    assert result.status == "certified"
    assert len(result.regions) == 2
    assert all(region.pixel_count >= PROFILE.minimum_region_pixels for region in result.regions)
    assert all(region.bounds.left >= 3 and region.bounds.right <= 28 for region in result.regions)


def test_respects_opaque_antialiased_linework() -> None:
    image = _closed_two_section_fixture()
    draw = ImageDraw.Draw(image)
    draw.line((15, 4, 15, 19), fill=(180, 186, 192, 255), width=1)

    result = certify_connected_sections(image, PROFILE)

    assert result.status == "certified"
    assert len(result.regions) == 2


def test_rejects_an_open_outline_that_leaks_to_transparency() -> None:
    image = _closed_two_section_fixture()
    draw = ImageDraw.Draw(image)
    draw.rectangle((2, 9, 5, 13), fill=(0, 0, 0, 0))

    result = certify_connected_sections(image, PROFILE)

    assert result.status == "insufficient-bounded-regions"
    assert len(result.regions) < 2


def test_distinguishes_one_opaque_recolourable_body() -> None:
    image = Image.new("RGBA", (24, 20), (0, 0, 0, 0))
    ImageDraw.Draw(image).rounded_rectangle(
        (4, 3, 19, 16),
        radius=3,
        fill=(245, 245, 245, 255),
        outline=(30, 38, 48, 255),
        width=2,
    )

    result = certify_opaque_body(image, minimum_alpha=200)

    assert result.status == "certified"
    assert result.opaque_pixels > 0
    assert result.bounds.left == 4
    assert result.bounds.top == 3


def test_rejects_a_fully_transparent_body() -> None:
    result = certify_opaque_body(
        Image.new("RGBA", (12, 12), (0, 0, 0, 0)),
        minimum_alpha=200,
    )

    assert result.status == "empty-body"
