from unittest import TestCase

from apps.volume_price_merge.api.handlers.workbook_reader import WorkbookReader

from .helpers import make_invalid_xlsx_upload, make_xlsx_upload


class WorkbookReaderTests(TestCase):
    def setUp(self) -> None:
        self.reader = WorkbookReader()

    def test_reads_a1_from_first_worksheet(self) -> None:
        uploaded_file = make_xlsx_upload(
            "果品產量及產值.xlsx",
            "第一張工作表標題",
            second_sheet_title="第二張工作表標題",
        )

        result = self.reader.read_title_text(uploaded_file)

        self.assertEqual(result, "第一張工作表標題")

    def test_none_a1_raises_value_error(self) -> None:
        uploaded_file = make_xlsx_upload("果品產量及產值.xlsx", None)

        with self.assertRaisesRegex(ValueError, "A1 沒有有效標題"):
            self.reader.read_title_text(uploaded_file)

    def test_blank_a1_raises_value_error(self) -> None:
        uploaded_file = make_xlsx_upload("果品產量及產值.xlsx", "   ")

        with self.assertRaisesRegex(ValueError, "A1 沒有有效標題"):
            self.reader.read_title_text(uploaded_file)

    def test_invalid_xlsx_content_raises_value_error(self) -> None:
        uploaded_file = make_invalid_xlsx_upload("果品產量及產值.xlsx")

        with self.assertRaisesRegex(ValueError, "無法讀取 Excel"):
            self.reader.read_title_text(uploaded_file)

    def test_file_pointer_returns_to_start_after_success(self) -> None:
        uploaded_file = make_xlsx_upload(
            "果品產量及產值.xlsx", "果品產量及產值"
        )
        uploaded_file.seek(3)

        self.reader.read_title_text(uploaded_file)

        self.assertEqual(uploaded_file.tell(), 0)

    def test_file_pointer_returns_to_start_after_failure(self) -> None:
        uploaded_file = make_invalid_xlsx_upload("果品產量及產值.xlsx")
        uploaded_file.seek(3)

        with self.assertRaises(ValueError):
            self.reader.read_title_text(uploaded_file)

        self.assertEqual(uploaded_file.tell(), 0)
