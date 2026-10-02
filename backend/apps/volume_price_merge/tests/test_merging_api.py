from datetime import timedelta
from tempfile import TemporaryDirectory
from unittest.mock import patch
from uuid import uuid4

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.jobs.models import Job
from apps.volume_price_merge.models import MergeInputFile, VolumePriceMergeJob

from .helpers import make_matrix_xlsx_upload


class MergingApiTests(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.temporary_media_root = TemporaryDirectory()
        self.media_settings = self.settings(
            MEDIA_ROOT=self.temporary_media_root.name,
        )
        self.media_settings.enable()
        self.addCleanup(self.temporary_media_root.cleanup)
        self.addCleanup(self.media_settings.disable)

    def _create_job(
        self,
        *,
        status_value: str = Job.Status.PENDING,
        expired: bool = False,
        with_inputs: bool = True,
    ) -> Job:
        job = Job.objects.create(
            kind=Job.Kind.VOLUME_PRICE_MERGE,
            status=status_value,
            expires_at=timezone.now() + timedelta(hours=-1 if expired else 1),
        )
        merge_job = VolumePriceMergeJob.objects.create(job=job, pairing_preview={})
        if with_inputs:
            for property_type, filename, metric, values in (
                (
                    MergeInputFile.PropertyType.PRODUCTION,
                    "果品產量及產值.xlsx",
                    "果品產量",
                    [123, 456],
                ),
                (
                    MergeInputFile.PropertyType.AREA,
                    "果品種植及收穫面積.xlsx",
                    "種植面積",
                    [10, 20],
                ),
            ):
                uploaded_file = make_matrix_xlsx_upload(
                    filename,
                    [
                        ["匿名測試資料", None, None],
                        [None, "110年", "111年"],
                        ["品項", "香蕉", "香蕉"],
                        [metric, *values],
                    ],
                )
                MergeInputFile.objects.create(
                    merge_job=merge_job,
                    property_type=property_type,
                    major_category="果品",
                    original_name=filename,
                    file=uploaded_file,
                    size_bytes=uploaded_file.size,
                )
        return job

    @staticmethod
    def _url(public_id) -> str:
        return reverse(
            "volume_price_merge:merging",
            kwargs={"public_id": public_id},
        )

    def test_run_returns_200_and_persisted_summary(self) -> None:
        job = self._create_job()

        response = self.client.post(self._url(job.public_id), data={}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload["data"]["public_id"], str(job.public_id))
        self.assertEqual(payload["data"]["status"], Job.Status.SUCCEEDED)
        self.assertEqual(
            payload["data"]["summary"],
            {
                "column_count": 2,
                "row_count": 2,
                "available_crops": ["香蕉"],
            },
        )
        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.SUCCEEDED)

    def test_missing_job_returns_404(self) -> None:
        response = self.client.post(self._url(uuid4()), data={}, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.json()["code"], "job_not_found")

    def test_expired_job_returns_410(self) -> None:
        job = self._create_job(expired=True, with_inputs=False)

        response = self.client.post(self._url(job.public_id), data={}, format="json")

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertEqual(response.json()["code"], "job_expired")
        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.EXPIRED)

    def test_repeated_run_returns_409(self) -> None:
        job = self._create_job()
        first_response = self.client.post(self._url(job.public_id), data={}, format="json")

        second_response = self.client.post(
            self._url(job.public_id),
            data={},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(second_response.json()["code"], "job_not_runnable")

    def test_unexpected_failure_returns_safe_500(self) -> None:
        job = self._create_job(with_inputs=False)
        with patch(
            "apps.volume_price_merge.api.views.merging_view.MergingService.run",
            side_effect=RuntimeError("Traceback: C:\\private\\server-path"),
        ):
            response = self.client.post(self._url(job.public_id), data={}, format="json")

        self.assertEqual(
            response.status_code,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        payload = response.json()
        self.assertEqual(payload["code"], "internal_server_error")
        self.assertEqual(payload["field_errors"], {})
        self.assertNotIn("Traceback", str(payload))
        self.assertNotIn("C:\\", str(payload))
