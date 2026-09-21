from unittest import TestCase

from apps.volume_price_merge.api.handlers.pair_validator import PairValidator


def production_info(category: str, filename: str = "production.xlsx") -> dict:
    return {
        "major_category": category,
        "property_type": "production",
        "file_name": filename,
    }


def area_info(category: str, filename: str = "area.xlsx") -> dict:
    return {
        "major_category": category,
        "property_type": "area",
        "file_name": filename,
    }


class PairValidatorTests(TestCase):
    def setUp(self) -> None:
        self.validator = PairValidator()

    def test_one_category_with_one_file_of_each_type_is_complete(self) -> None:
        result = self.validator.build_preview(
            [production_info("果品", "果品產量及產值.xlsx")],
            [area_info("果品", "果品種植及收穫面積.xlsx")],
        )

        self.assertEqual(
            result,
            {
                "is_valid": True,
                "pairs": [
                    {
                        "major_category": "果品",
                        "production_files": ["果品產量及產值.xlsx"],
                        "area_files": ["果品種植及收穫面積.xlsx"],
                        "complete": True,
                    }
                ],
                "errors": [],
            },
        )

    def test_missing_production_file_is_incomplete(self) -> None:
        result = self.validator.build_preview([], [area_info("果品")])

        self.assertFalse(result["is_valid"])
        self.assertFalse(result["pairs"][0]["complete"])
        self.assertIn("缺少產量及產值檔案", result["errors"][0])

    def test_missing_area_file_is_incomplete(self) -> None:
        result = self.validator.build_preview([production_info("果品")], [])

        self.assertFalse(result["is_valid"])
        self.assertFalse(result["pairs"][0]["complete"])
        self.assertIn("缺少種植及收穫面積檔案", result["errors"][0])

    def test_duplicate_production_files_are_incomplete(self) -> None:
        result = self.validator.build_preview(
            [
                production_info("果品", "production-1.xlsx"),
                production_info("果品", "production-2.xlsx"),
            ],
            [area_info("果品")],
        )

        self.assertFalse(result["is_valid"])
        self.assertFalse(result["pairs"][0]["complete"])
        self.assertIn("重複的產量及產值檔案", result["errors"][0])

    def test_duplicate_area_files_are_incomplete(self) -> None:
        result = self.validator.build_preview(
            [production_info("果品")],
            [
                area_info("果品", "area-1.xlsx"),
                area_info("果品", "area-2.xlsx"),
            ],
        )

        self.assertFalse(result["is_valid"])
        self.assertFalse(result["pairs"][0]["complete"])
        self.assertIn("重複的種植及收穫面積檔案", result["errors"][0])

    def test_multiple_complete_categories_are_valid(self) -> None:
        result = self.validator.build_preview(
            [production_info("果品"), production_info("蔬菜")],
            [area_info("果品"), area_info("蔬菜")],
        )

        pairs_by_category = {
            pair["major_category"]: pair for pair in result["pairs"]
        }
        self.assertTrue(result["is_valid"])
        self.assertEqual(set(pairs_by_category), {"果品", "蔬菜"})
        self.assertTrue(pairs_by_category["果品"]["complete"])
        self.assertTrue(pairs_by_category["蔬菜"]["complete"])

    def test_any_incomplete_category_makes_whole_preview_invalid(self) -> None:
        result = self.validator.build_preview(
            [production_info("果品"), production_info("蔬菜")],
            [area_info("果品")],
        )

        pairs_by_category = {
            pair["major_category"]: pair for pair in result["pairs"]
        }
        self.assertFalse(result["is_valid"])
        self.assertTrue(pairs_by_category["果品"]["complete"])
        self.assertFalse(pairs_by_category["蔬菜"]["complete"])

    def test_pair_items_have_the_confirmed_schema(self) -> None:
        result = self.validator.build_preview(
            [production_info("果品")],
            [area_info("果品")],
        )

        self.assertEqual(
            set(result["pairs"][0]),
            {"major_category", "production_files", "area_files", "complete"},
        )
