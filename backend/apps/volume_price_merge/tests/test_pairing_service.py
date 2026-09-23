from unittest import TestCase

from apps.volume_price_merge.api.services.pairing_service import PairingService

from .helpers import make_invalid_xlsx_upload, make_xlsx_upload


class PairingServiceTests(TestCase):
    def setUp(self) -> None:
        self.service = PairingService()

    def test_build_preview_with_in_memory_xlsx_files(self) -> None:
        production = make_xlsx_upload(
            "110-113年果品產量及產值.xlsx",
            "110-113年果品產量及產值",
        )
        area = make_xlsx_upload(
            "110-113年果品種植及收穫面積.xlsx",
            "110-113年果品種植及收穫面積",
        )

        result = self.service.build_preview([production], [area])

        pairing_result = result["pairing_result"]
        self.assertTrue(pairing_result["is_valid"])
        self.assertEqual(pairing_result["errors"], [])
        self.assertEqual(pairing_result["pairs"][0]["major_category"], "果品")
        self.assertTrue(pairing_result["pairs"][0]["complete"])

        file_infos = result["uploaded_file_infos"]
        self.assertEqual(len(file_infos), 2)
        self.assertIs(file_infos[0]["uploaded_file"], production)
        self.assertEqual(file_infos[0]["property_type"], "production")
        self.assertIs(file_infos[1]["uploaded_file"], area)
        self.assertEqual(file_infos[1]["property_type"], "area")
        self.assertTrue(all(info["major_category"] == "果品" for info in file_infos))

    def test_different_categories_create_incomplete_pairs(self) -> None:
        production = make_xlsx_upload(
            "果品產量及產值.xlsx", "果品產量及產值"
        )
        area = make_xlsx_upload(
            "蔬菜種植及收穫面積.xlsx", "蔬菜種植及收穫面積"
        )

        result = self.service.build_preview([production], [area])

        pairing_result = result["pairing_result"]
        self.assertFalse(pairing_result["is_valid"])
        self.assertEqual(len(pairing_result["pairs"]), 2)
        self.assertTrue(
            all(not pair["complete"] for pair in pairing_result["pairs"])
        )
        self.assertEqual(len(pairing_result["errors"]), 2)

    def test_mismatched_filename_and_a1_raise_value_error(self) -> None:
        production = make_xlsx_upload(
            "果品產量及產值.xlsx", "蔬菜產量及產值"
        )
        area = make_xlsx_upload(
            "果品種植及收穫面積.xlsx", "果品種植及收穫面積"
        )

        with self.assertRaisesRegex(ValueError, "不一致"):
            self.service.build_preview([production], [area])

    def test_invalid_workbook_raises_value_error(self) -> None:
        production = make_invalid_xlsx_upload("果品產量及產值.xlsx")
        area = make_xlsx_upload(
            "果品種植及收穫面積.xlsx", "果品種植及收穫面積"
        )

        with self.assertRaisesRegex(ValueError, "無法讀取 Excel"):
            self.service.build_preview([production], [area])
