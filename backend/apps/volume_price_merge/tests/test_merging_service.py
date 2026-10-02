from datetime import timedelta
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.jobs.models import Job
from apps.volume_price_merge.api.services.merging_service import (
    MergeJobExpired,
    MergeJobNotRunnable,
    MergingService,
)
from apps.volume_price_merge.models import MergeInputFile, VolumePriceMergeJob

from .helpers import make_matrix_xlsx_upload


class MergingServiceTests(TestCase):
    def setUp(self) -> None:
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
        status: str = Job.Status.PENDING,
        expired: bool = False,
        with_inputs: bool = True,
    ) -> tuple[Job, VolumePriceMergeJob]:
        expires_at = timezone.now() + timedelta(hours=-1 if expired else 1)
        job = Job.objects.create(
            kind=Job.Kind.VOLUME_PRICE_MERGE,
            status=status,
            expires_at=expires_at,
        )
        merge_job = VolumePriceMergeJob.objects.create(
            job=job,
            pairing_preview={},
        )
        if with_inputs:
            self._create_input(
                merge_job,
                MergeInputFile.PropertyType.PRODUCTION,
                "果品產量及產值.xlsx",
                "果品產量",
                [123, 456],
            )
            self._create_input(
                merge_job,
                MergeInputFile.PropertyType.AREA,
                "果品種植及收穫面積.xlsx",
                "種植面積",
                [10, 20],
            )
        return job, merge_job

    @staticmethod
    def _create_input(
        merge_job: VolumePriceMergeJob,
        property_type: str,
        filename: str,
        metric: str,
        values: list[int],
    ) -> None:
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

    def test_run_persists_result_and_returns_summary(self) -> None:
        job, merge_job = self._create_job()

        result = MergingService().run(job.public_id)

        job.refresh_from_db()
        merge_job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.SUCCEEDED)
        self.assertEqual(result["public_id"], job.public_id)
        self.assertEqual(result["status"], Job.Status.SUCCEEDED)
        self.assertEqual(
            result["summary"],
            {
                "column_count": 2,
                "row_count": 2,
                "available_crops": ["香蕉"],
            },
        )
        self.assertEqual(merge_job.result_data["summary"]["column_count"], 2)
        self.assertEqual(merge_job.result_data["summary"]["row_count"], 2)
        self.assertEqual(merge_job.result_data["available_crops"], ["香蕉"])
        self.assertEqual(len(merge_job.result_data["columns"]), 2)
        self.assertEqual(len(merge_job.result_data["rows"]), 2)

    def test_expired_job_is_marked_expired_and_rejected(self) -> None:
        job, _merge_job = self._create_job(expired=True, with_inputs=False)

        with self.assertRaises(MergeJobExpired):
            MergingService().run(job.public_id)

        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.EXPIRED)

    def test_non_pending_job_is_rejected_without_changing_status(self) -> None:
        job, _merge_job = self._create_job(
            status=Job.Status.SUCCEEDED,
            with_inputs=False,
        )

        with self.assertRaises(MergeJobNotRunnable):
            MergingService().run(job.public_id)

        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.SUCCEEDED)

    def test_build_failure_marks_running_job_failed(self) -> None:
        job, _merge_job = self._create_job(with_inputs=False)

        with patch.object(
            MergingService,
            "_build_result",
            side_effect=ValueError("anonymous invalid workbook"),
        ):
            with self.assertRaises(ValueError):
                MergingService().run(job.public_id)

        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.FAILED)
        self.assertEqual(job.error_code, "merge_failed")
        self.assertNotIn("anonymous invalid workbook", job.error_message)
