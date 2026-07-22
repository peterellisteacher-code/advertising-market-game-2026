from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in (
        Path(r"C:\Windows\Fonts\arial.ttf"),
        Path(r"C:\Windows\Fonts\segoeui.ttf"),
    ):
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def build_sheet(paths: list[Path], output: Path, sheet_number: int) -> None:
    images = [Image.open(path).convert("RGB") for path in paths]
    try:
        tile_width = max(image.width for image in images)
        tile_height = max(image.height for image in images)
        caption_height = 52
        margin = 20
        columns = 2
        rows = 2
        canvas = Image.new(
            "RGB",
            (
                margin * (columns + 1) + tile_width * columns,
                margin * (rows + 1) + (tile_height + caption_height) * rows,
            ),
            "#efe9df",
        )
        draw = ImageDraw.Draw(canvas)
        font = load_font(28)
        for index, (path, image) in enumerate(zip(paths, images, strict=True)):
            column = index % columns
            row = index // columns
            x = margin + column * (tile_width + margin)
            y = margin + row * (tile_height + caption_height + margin)
            image_x = x + (tile_width - image.width) // 2
            image_y = y + (tile_height - image.height) // 2
            canvas.paste(image, (image_x, image_y))
            draw.rectangle((x, y + tile_height, x + tile_width, y + tile_height + caption_height), fill="#111827")
            draw.text((x + 14, y + tile_height + 10), path.name, fill="#ffffff", font=font)
        draw.text((margin, canvas.height - 15), f"Current browser evidence contact sheet {sheet_number}", fill="#111827", font=load_font(18), anchor="ls")
        output.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(output, format="JPEG", quality=90, optimize=True, progressive=True)
    finally:
        for image in images:
            image.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    screenshots = sorted(args.input_dir.glob("final-*.png"))
    if len(screenshots) != 19:
        raise SystemExit(f"expected_19_current_screenshots_found_{len(screenshots)}")
    groups = [screenshots[index : index + 4] for index in range(0, len(screenshots), 4)]
    for number, group in enumerate(groups, start=1):
        build_sheet(group, args.output_dir / f"student-experience-contact-sheet-{number}.jpg", number)
    print(f"CONTACT_SHEETS_OK count={len(groups)} screenshots={len(screenshots)}")


if __name__ == "__main__":
    main()
