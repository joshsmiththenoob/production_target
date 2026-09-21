import json

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .helpers import make_invalid_xlsx_upload, make_xlsx_upload


class PairingApiTests(APITestCase):
    def setUp(self) -> None:
        self.url = reverse("volume_price_merge:pairing")

    @staticmethod
    def _production_file(category: str = "果品"):
        return make_xlsx_upload(
            f"{category}產量及產值.xlsx", f"{category}產量及產值"
        )

    @staticmethod
    def _area_file(category: str = "果品"):
        return make_xlsx_upload(
            f"{category}種植及收穫面積.xlsx", f"{category}種植及收穫面積"
        )

    def test_complete_multipart_pair_returns_200(self) -> None:
        response = self.client.post(
            self.url,
            data={
                "production_files": [self._production_file()],
                "area_files": [self._area_file()],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertIn("message", payload)
        self.assertTrue(payload["data"]["is_valid"])
        self.assertEqual(payload["data"]["errors"], [])
        self.assertEqual(
            payload["data"]["pairs"],
            [
                {
                    "major_category": "果品",
                    "production_files": ["果品產量及產值.xlsx"],
                    "area_files": ["果品種植及收穫面積.xlsx"],
                    "complete": True,
                }
            ],
        )

    def test_non_xlsx_upload_returns_invalid_upload(self) -> None:
        invalid_file = SimpleUploadedFile(
            "果品產量及產值.csv", b"anonymous,data", content_type="text/csv"
        )

        response = self.client.post(
            self.url,
            data={
                "production_files": [invalid_file],
                "area_files": [self._area_file()],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payload = response.json()
        self.assertEqual(payload["code"], "invalid_upload")
        self.assertIsInstance(payload["message"], str)
        self.assertIn("production_files", payload["field_errors"])

    def test_missing_file_group_returns_invalid_upload(self) -> None:
        response = self.client.post(
            self.url,
            data={"production_files": [self._production_file()]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payload = response.json()
        self.assertEqual(payload["code"], "invalid_upload")
        self.assertIn("area_files", payload["field_errors"])

    def test_incomplete_pair_returns_invalid_pairing(self) -> None:
        response = self.client.post(
            self.url,
            data={
                "production_files": [self._production_file("果品")],
                "area_files": [self._area_file("蔬菜")],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payload = response.json()
        self.assertEqual(payload["code"], "invalid_pairing")
        self.assertIsInstance(payload["message"], str)
        self.assertFalse(payload["field_errors"]["is_valid"])
        self.assertEqual(len(payload["field_errors"]["pairs"]), 2)
        self.assertEqual(len(payload["field_errors"]["errors"]), 2)

    def test_invalid_workbook_returns_safe_invalid_workbook_error(self) -> None:
        response = self.client.post(
            self.url,
            data={
                "production_files": [
                    make_invalid_xlsx_upload("果品產量及產值.xlsx")
                ],
                "area_files": [self._area_file()],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self._assert_safe_invalid_workbook_response(response.json())

    def test_blank_a1_returns_invalid_workbook(self) -> None:
        blank_title_file = make_xlsx_upload("果品產量及產值.xlsx", "   ")

        response = self.client.post(
            self.url,
            data={
                "production_files": [blank_title_file],
                "area_files": [self._area_file()],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self._assert_safe_invalid_workbook_response(response.json())

    def test_filename_and_a1_mismatch_returns_invalid_workbook(self) -> None:
        mismatched_file = make_xlsx_upload(
            "果品產量及產值.xlsx", "蔬菜產量及產值"
        )

        response = self.client.post(
            self.url,
            data={
                "production_files": [mismatched_file],
                "area_files": [self._area_file()],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self._assert_safe_invalid_workbook_response(response.json())

    def _assert_safe_invalid_workbook_response(self, payload: dict) -> None:
        self.assertEqual(payload["code"], "invalid_workbook")
        self.assertIsInstance(payload["message"], str)
        self.assertEqual(payload["field_errors"], {})

        serialized_payload = json.dumps(payload, ensure_ascii=False)
        self.assertNotIn("Traceback", serialized_payload)
        self.assertNotIn("C:\\\\", serialized_payload)
        self.assertNotIn("/app/", serialized_payload)
