import json
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.jobs.models import Job
from apps.volume_price_merge.models import MergeInputFile, VolumePriceMergeJob

from .helpers import make_invalid_xlsx_upload, make_xlsx_upload


class PairingApiTests(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse("volume_price_merge:pairing")
        self.temporary_media_root = TemporaryDirectory()
        self.media_settings = self.settings(
            MEDIA_ROOT=self.temporary_media_root.name
        )
        self.media_settings.enable()
        self.addCleanup(self.temporary_media_root.cleanup)
        self.addCleanup(self.media_settings.disable)

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

    def test_complete_multipart_pair_creates_job_and_stores_input_files(self) -> None:
        production_file = self._production_file()
        area_file = self._area_file()

        response = self.client.post(
            self.url,
            data={
                "production_files": [production_file],
                "area_files": [area_file],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = response.json()
        self.assertIn("message", payload)
        self.assertIn("public_id", payload["data"])

        pairing_result = payload["data"]["pairing_result"]
        self.assertTrue(pairing_result["is_valid"])
        self.assertEqual(pairing_result["errors"], [])
        self.assertEqual(
            pairing_result["pairs"],
            [
                {
                    "major_category": "果品",
                    "production_files": ["果品產量及產值.xlsx"],
                    "area_files": ["果品種植及收穫面積.xlsx"],
                    "complete": True,
                }
            ],
        )

        job = Job.objects.get(public_id=payload["data"]["public_id"])
        self.assertEqual(job.kind, Job.Kind.VOLUME_PRICE_MERGE)
        self.assertEqual(job.status, Job.Status.PENDING)
        self.assertGreater(job.expires_at, job.created_at)

        merge_job = VolumePriceMergeJob.objects.get(job=job)
        self.assertEqual(merge_job.pairing_preview, pairing_result)

        input_files = {
            item.property_type: item
            for item in MergeInputFile.objects.filter(merge_job=merge_job)
        }
        self.assertEqual(
            set(input_files),
            {MergeInputFile.PropertyType.PRODUCTION, MergeInputFile.PropertyType.AREA},
        )
        self.assertEqual(MergeInputFile.objects.count(), 2)

        expected_files = {
            MergeInputFile.PropertyType.PRODUCTION: "果品產量及產值.xlsx",
            MergeInputFile.PropertyType.AREA: "果品種植及收穫面積.xlsx",
        }
        media_root = Path(self.temporary_media_root.name)

        for property_type, original_name in expected_files.items():
            with self.subTest(property_type=property_type):
                stored_file = input_files[property_type]
                expected_directory = (
                    media_root
                    / "jobs"
                    / str(merge_job.pk)
                    / "inputs"
                    / property_type
                )

                self.assertEqual(stored_file.original_name, original_name)
                self.assertEqual(stored_file.major_category, "果品")
                self.assertTrue(stored_file.file.name.endswith(".xlsx"))
                self.assertEqual(Path(stored_file.file.path).parent, expected_directory)
                self.assertTrue(Path(stored_file.file.path).is_file())
                self.assertGreater(stored_file.size_bytes, 0)
                self.assertEqual(stored_file.file.size, stored_file.size_bytes)

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
        self._assert_no_job_records()

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
        self._assert_no_job_records()

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
        self._assert_no_job_records()

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
        self._assert_no_job_records()

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
        self._assert_no_job_records()

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
        self._assert_no_job_records()

    def _assert_safe_invalid_workbook_response(self, payload: dict) -> None:
        self.assertEqual(payload["code"], "invalid_workbook")
        self.assertIsInstance(payload["message"], str)
        self.assertEqual(payload["field_errors"], {})

        serialized_payload = json.dumps(payload, ensure_ascii=False)
        self.assertNotIn("Traceback", serialized_payload)
        self.assertNotIn("C:\\\\", serialized_payload)
        self.assertNotIn("/app/", serialized_payload)

    def _assert_no_job_records(self) -> None:
        self.assertFalse(Job.objects.exists())
        self.assertFalse(VolumePriceMergeJob.objects.exists())
        self.assertFalse(MergeInputFile.objects.exists())
