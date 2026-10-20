from unittest import TestCase
from unittest.mock import patch

import pandas as pd
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.table_compare.api.handlers.normalization import COMMON_COLUMNS
from apps.table_compare.api.services.comparing_service import ComparingService


def make_frame(rows: list[list[object]]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=COMMON_COLUMNS)


class ComparingPreviewServiceTests(TestCase):
    def setUp(self) -> None:
        self.excel_file = SimpleUploadedFile("完整合併.xlsx", b"excel")
        self.pdf_file = SimpleUploadedFile("農產品.pdf", b"pdf")

    @patch(
        "apps.table_compare.api.services.comparing_service.PDFTableAdapter"
    )
    @patch(
        "apps.table_compare.api.services.comparing_service.ExcelTableAdapter"
    )
    def test_build_preview_uses_excel_crops_and_common_years(
        self,
        excel_adapter_class,
        pdf_adapter_class,
    ) -> None:
        excel_adapter_class.return_value.load.return_value = make_frame([
            ["稻米", "稻米", 110, "產值", "千元", 1],
            ["稻米", "稻米", 111, "產量", "公噸", 2],
            ["果品", "香蕉", 112, "產量", "公噸", 3],
            ["特作", "茶", 112, "種植面積", "公頃", 4],
            ["特作", "茶", 112, "收穫面積", "公頃", 4],
            ["果品", "香蕉", 112, "未支援指標", "", 5],
            ["果品", "", 112, "產量", "公噸", 6],
        ])
        pdf_adapter = pdf_adapter_class.return_value
        pdf_adapter.load.return_value = make_frame([
            ["稻米", "糙米", 111, "產量", "公噸", 2],
            ["果品", "香蕉", 112, "產量", "公噸", 3],
            ["雜糧", "小麥", 109, "產量", "公噸", 7],
        ])
        pdf_adapter.skipped_pages = []
        service = ComparingService()

        with patch.object(
            service._table_comparactor,
            "start_comparing",
        ) as start_comparing:
            result = service.build_preview(self.excel_file, self.pdf_file)

        self.assertEqual(result["crops"], ["糙米", "香蕉", "茶"])
        self.assertEqual(result["years"], [111, 112])
        self.assertEqual(
            result["metrics"],
            ["產量", "產值", "種植面積", "收穫面積"],
        )
        self.assertEqual(
            result["defaults"],
            {
                "crops": ["糙米", "香蕉", "茶"],
                "years": [111, 112],
                "metrics": ["產量", "產值", "種植面積", "收穫面積"],
            },
        )
        self.assertTrue(any("茶" in issue for issue in result["issues"]))
        self.assertTrue(any("解析結果未找到" in issue for issue in result["issues"]))
        start_comparing.assert_not_called()

    @patch(
        "apps.table_compare.api.services.comparing_service.PDFTableAdapter"
    )
    @patch(
        "apps.table_compare.api.services.comparing_service.ExcelTableAdapter"
    )
    def test_no_common_years_and_skipped_pages_are_explicit_issues(
        self,
        excel_adapter_class,
        pdf_adapter_class,
    ) -> None:
        excel_adapter_class.return_value.load.return_value = make_frame([
            ["果品", "香蕉", 110, "產量", "公噸", 1],
        ])
        pdf_adapter = pdf_adapter_class.return_value
        pdf_adapter.load.return_value = make_frame([
            ["果品", "香蕉", 111, "產量", "公噸", 1],
        ])
        pdf_adapter.skipped_pages = [
            {"頁碼": 3, "原因": "目前尚未支援這個表格版型"},
        ]

        result = ComparingService().build_preview(
            self.excel_file,
            self.pdf_file,
        )

        self.assertEqual(result["years"], [])
        self.assertEqual(result["defaults"]["years"], [])
        self.assertIn("Excel 與 PDF 沒有共同實績年度。", result["issues"])
        self.assertIn(
            "PDF 第 3 頁未解析：目前尚未支援這個表格版型",
            result["issues"],
        )
