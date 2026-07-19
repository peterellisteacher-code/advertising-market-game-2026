from __future__ import annotations

import unittest

from PIL import Image, ImageDraw

from extract_contact_sheets import (
    analyse_cell,
    detect_grid_subjects,
    detect_ordered_row_subjects,
    detect_row_layout_subjects,
    key_chroma,
    prepare_cell,
    split_sheet,
)


class ContactSheetExtractionTests(unittest.TestCase):
    def test_splits_a_regular_grid_without_resampling(self) -> None:
        sheet = Image.new("RGB", (101, 99), "#00ff00")

        cells = split_sheet(sheet, columns=5, rows=3)

        self.assertEqual(len(cells), 15)
        self.assertEqual((cells[0].row, cells[0].column), (1, 1))
        self.assertEqual((cells[-1].row, cells[-1].column), (3, 5))
        self.assertEqual(sum(cell.image.width for cell in cells[:5]), sheet.width)
        self.assertEqual(sum(cells[index].image.height for index in (0, 5, 10)), sheet.height)

    def test_detects_a_complete_subject_that_crosses_a_math_grid_boundary(self) -> None:
        sheet = Image.new("RGB", (100, 40), "#00ff00")
        draw = ImageDraw.Draw(sheet)
        draw.rectangle((10, 8, 53, 31), fill="white", outline="black")
        draw.rectangle((64, 10, 91, 29), fill="white", outline="black")

        cells = detect_grid_subjects(
            sheet,
            columns=2,
            rows=1,
            source_padding=15,
            minimum_component_pixels=4,
        )

        self.assertEqual([(cell.row, cell.column) for cell in cells], [(1, 1), (1, 2)])
        left_box = key_chroma(cells[0].image).getchannel("A").point(
            lambda value: 255 if value > 8 else 0
        ).getbbox()
        right_box = key_chroma(cells[1].image).getchannel("A").point(
            lambda value: 255 if value > 8 else 0
        ).getbbox()
        self.assertIsNotNone(left_box)
        self.assertIsNotNone(right_box)
        self.assertEqual(left_box[2] - left_box[0], 44)
        self.assertEqual(right_box[2] - right_box[0], 28)

    def test_detects_a_bounded_irregular_row_layout(self) -> None:
        sheet = Image.new("RGB", (120, 80), "#00ff00")
        draw = ImageDraw.Draw(sheet)
        for centre_x in (30, 90):
            draw.rectangle((centre_x - 12, 8, centre_x + 12, 31), fill="white", outline="black")
        for centre_x in (20, 60, 100):
            draw.rectangle((centre_x - 10, 48, centre_x + 10, 71), fill="white", outline="black")

        cells = detect_row_layout_subjects(
            sheet,
            row_counts=(2, 3),
            source_padding=4,
            minimum_component_pixels=4,
        )

        self.assertEqual(
            [(cell.row, cell.column) for cell in cells],
            [(1, 1), (1, 2), (2, 1), (2, 2), (2, 3)],
        )
        self.assertTrue(all(key_chroma(cell.image).getchannel("A").getbbox() for cell in cells))

    def test_orders_complete_components_when_row_spacing_is_uneven(self) -> None:
        sheet = Image.new("RGB", (160, 50), "#00ff00")
        draw = ImageDraw.Draw(sheet)
        for centre_x in (12, 42, 78, 143):
            draw.rectangle((centre_x - 7, 12, centre_x + 7, 37), fill="white", outline="black")

        cells = detect_ordered_row_subjects(
            sheet,
            row_counts=(4,),
            source_padding=4,
            minimum_component_pixels=4,
        )

        self.assertEqual([(cell.row, cell.column) for cell in cells], [(1, 1), (1, 2), (1, 3), (1, 4)])
        self.assertTrue(all(key_chroma(cell.image).getchannel("A").getbbox() for cell in cells))

    def test_removes_exact_green_and_decontaminates_antialiased_edges(self) -> None:
        source = Image.new("RGBA", (7, 1))
        source.putdata([
            (0, 255, 0, 255),
            (21, 241, 19, 255),
            (50, 200, 45, 255),
            (128, 255, 128, 255),
            (140, 250, 120, 255),
            (0, 128, 0, 255),
            (255, 255, 255, 255),
        ])

        keyed = key_chroma(source)
        pixels = list(keyed.getdata())

        self.assertEqual(pixels[0][3], 0)
        self.assertEqual(pixels[1][3], 0)
        self.assertEqual(pixels[2][3], 0)
        self.assertIn(pixels[3][3], range(126, 130))
        self.assertLessEqual(max(pixels[3][:3]) - min(pixels[3][:3]), 2)
        self.assertIn(pixels[4][3], range(138, 142))
        self.assertEqual(max(pixels[4][:3]) - min(pixels[4][:3]), 0)
        self.assertIn(pixels[5][3], range(126, 130))
        self.assertLessEqual(max(pixels[5][:3]), 2)
        self.assertEqual(pixels[6], (255, 255, 255, 255))

    def test_prepares_master_silhouette_and_ink_layers_for_recolouring(self) -> None:
        source = Image.new("RGB", (40, 40), "#00ff00")
        draw = ImageDraw.Draw(source)
        draw.rectangle((10, 8, 29, 31), fill="white", outline="black", width=2)

        prepared = prepare_cell(source, trim_padding=2)

        self.assertEqual(prepared.master.mode, "RGBA")
        self.assertEqual(prepared.silhouette.mode, "L")
        self.assertEqual(prepared.ink_overlay.mode, "RGBA")
        self.assertEqual(prepared.master.size, prepared.silhouette.size)
        self.assertEqual(prepared.master.size, prepared.ink_overlay.size)
        self.assertEqual(prepared.master.getpixel((0, 0))[3], 0)
        centre = (prepared.master.width // 2, prepared.master.height // 2)
        self.assertEqual(prepared.silhouette.getpixel(centre), 255)
        self.assertEqual(prepared.ink_overlay.getpixel(centre)[3], 0)
        self.assertIsNotNone(prepared.ink_overlay.getchannel("A").getbbox())

    def test_prepared_asset_adds_a_safe_transparent_inset_at_a_source_edge(self) -> None:
        source = Image.new("RGB", (60, 60), "#00ff00")
        ImageDraw.Draw(source).rectangle((0, 12, 47, 47), fill="white", outline="black")

        prepared = prepare_cell(source, trim_padding=2, safe_inset_ratio=0.08)

        self.assertFalse(prepared.report.edge_contact)
        self.assertFalse(prepared.report.safe_inset_breach)
        self.assertIsNotNone(prepared.report.bounding_box)
        self.assertGreater(prepared.report.bounding_box[0], 0)

    def test_flags_cell_edge_contact_without_rejecting_a_centred_subject(self) -> None:
        centred = Image.new("RGB", (60, 60), "#00ff00")
        ImageDraw.Draw(centred).rectangle((12, 12, 47, 47), fill="white", outline="black")
        touching = Image.new("RGB", (60, 60), "#00ff00")
        ImageDraw.Draw(touching).rectangle((0, 12, 47, 47), fill="white", outline="black")
        near_edge = Image.new("RGB", (60, 60), "#00ff00")
        ImageDraw.Draw(near_edge).rectangle((2, 12, 47, 47), fill="white", outline="black")

        centred_report = analyse_cell(key_chroma(centred), safe_inset_ratio=0.08)
        touching_report = analyse_cell(key_chroma(touching), safe_inset_ratio=0.08)
        near_edge_report = analyse_cell(key_chroma(near_edge), safe_inset_ratio=0.08)

        self.assertFalse(centred_report.edge_contact)
        self.assertFalse(centred_report.safe_inset_breach)
        self.assertTrue(touching_report.edge_contact)
        self.assertTrue(touching_report.safe_inset_breach)
        self.assertFalse(near_edge_report.edge_contact)
        self.assertTrue(near_edge_report.safe_inset_breach)
        self.assertGreater(centred_report.opaque_pixel_count, 0)
        self.assertGreater(centred_report.short_edge, 0)


if __name__ == "__main__":
    unittest.main()
