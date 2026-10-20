from io import BytesIO
from unittest import TestCase
from unittest.mock import patch

from apps.table_compare.api.handlers.adapters.pdf_table_adapter import (
    PDFTableAdapter,
)
from apps.table_compare.api.handlers.normalization import COMMON_COLUMNS


class FakePage:
    def extract_text(self):
        return "無法辨識的頁面"

    def extract_table(self):
        return None


class FakePdf:
    pages = [FakePage()]

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False


class PDFTableAdapterTests(TestCase):
    @patch(
        "apps.table_compare.api.handlers.adapters.pdf_table_adapter.pdfplumber.open",
        return_value=FakePdf(),
    )
    def test_load_keeps_skipped_page_details_on_the_adapter(self, _open) -> None:
        adapter = PDFTableAdapter(BytesIO(b"anonymous pdf"))

        result = adapter.load()

        self.assertTrue(result.empty)
        self.assertEqual(list(result.columns), COMMON_COLUMNS)
        self.assertEqual(
            adapter.skipped_pages,
            [{"頁碼": 1, "原因": "找不到農產品分類"}],
        )
