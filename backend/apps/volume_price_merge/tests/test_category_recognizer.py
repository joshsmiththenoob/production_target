from unittest import TestCase

from apps.volume_price_merge.api.handlers.category_recognizer import (
    CategoryRecognizer,
)


class CategoryRecognizerTests(TestCase):
    def setUp(self) -> None:
        self.recognizer = CategoryRecognizer()

    def test_normalizes_production_filename(self) -> None:
        result = self.recognizer.recognize(
            file_name="110-113年果品產量及產值.xlsx",
            title_text="110-113年果品產量及產值",
        )

        self.assertEqual(result, "果品")

    def test_normalizes_area_filename(self) -> None:
        result = self.recognizer.recognize(
            file_name="110-113年果品種植及收穫面積.xlsx",
            title_text="110-113年果品種植及收穫面積",
        )

        self.assertEqual(result, "果品")

    def test_normalizes_spacing_hyphens_and_fixed_descriptions(self) -> None:
        result = self.recognizer.recognize(
            file_name=" 110 - 113 年_果品－按縣市別_產量及產值.XLSX",
            title_text="110至113年（果品） 按縣市 種植及收穫面積",
        )

        self.assertEqual(result, "果品")

    def test_matching_filename_and_title_return_category(self) -> None:
        result = self.recognizer.recognize(
            file_name="蔬菜產量及產值.xlsx",
            title_text="蔬菜種植及收穫面積",
        )

        self.assertEqual(result, "蔬菜")

    def test_mismatched_filename_and_title_raise_value_error(self) -> None:
        with self.assertRaisesRegex(ValueError, "不一致"):
            self.recognizer.recognize(
                file_name="果品產量及產值.xlsx",
                title_text="蔬菜產量及產值",
            )
