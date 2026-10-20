from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


def excel_upload():
    return SimpleUploadedFile(
        "完整合併.xlsx",
        b"anonymous excel",
        content_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
    )


def pdf_upload():
    return SimpleUploadedFile(
        "農產品.pdf",
        b"anonymous pdf",
        content_type="application/pdf",
    )


class ComparingPreviewApiTests(APITestCase):
    def setUp(self) -> None:
        self.preview_url = reverse("table_compare:preview")
        self.comparing_url = reverse("table_compare:comparing")

    @patch(
        "apps.table_compare.api.views.comparison_preview_view."
        "ComparingService.build_preview"
    )
    def test_preview_accepts_only_files_and_returns_explicit_contract(
        self,
        build_preview,
    ) -> None:
        build_preview.return_value = {
            "crops": ["糙米", "香蕉", "茶"],
            "years": [111, 112],
            "metrics": ["產量", "產值"],
            "defaults": {
                "crops": ["糙米", "香蕉", "茶"],
                "years": [111, 112],
                "metrics": ["產量", "產值"],
            },
            "issues": [
                "目前的 PDF 解析結果未找到作物「茶」；"
                "這不代表來源 PDF 沒有資料。"
            ],
        }

        response = self.client.post(
            self.preview_url,
            data={"excel_file": excel_upload(), "pdf_file": pdf_upload()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload["data"], build_preview.return_value)
        self.assertEqual(payload["message"], "比對範圍預覽完成。")
        build_preview.assert_called_once()

    def test_preview_rejects_a_missing_pdf_file(self) -> None:
        response = self.client.post(
            self.preview_url,
            data={"excel_file": excel_upload()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["code"], "invalid_upload")
        self.assertIn("pdf_file", response.json()["field_errors"])

    @patch(
        "apps.table_compare.api.views.comparing_view."
        "ComparingService.compare"
    )
    def test_existing_comparing_api_keeps_its_scope_contract(
        self,
        compare,
    ) -> None:
        compare.return_value = {"row_count": 0, "rows": []}

        response = self.client.post(
            self.comparing_url,
            data={
                "excel_file": excel_upload(),
                "pdf_file": pdf_upload(),
                "crops": ["香蕉"],
                "years": [111],
                "metrics": ["產量"],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["data"], {"row_count": 0, "rows": []})
        compare.assert_called_once()
