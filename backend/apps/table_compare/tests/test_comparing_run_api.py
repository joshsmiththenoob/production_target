import json
from datetime import timedelta
from tempfile import TemporaryDirectory
from unittest.mock import patch
from uuid import uuid4

import pandas as pd
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from drf_spectacular.generators import SchemaGenerator
from rest_framework import status
from rest_framework.test import APITestCase

from apps.jobs.models import Job
from apps.table_compare.api.handlers.normalization import COMMON_COLUMNS
from apps.table_compare.api.services.comparing_service import ComparingService
from apps.table_compare.models import TableCompareJob

from .run_helpers import (
    DEFAULT_PREVIEW,
    create_compare_job,
    make_run_pdf_bytes,
    make_run_xlsx_bytes,
)


def make_frame(rows: list[list[object]]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=COMMON_COLUMNS)


class ComparingRunApiTests(APITestCase):
    def setUp(self) -> None:
        media = TemporaryDirectory()
        self.addCleanup(media.cleanup)
        media_settings = override_settings(MEDIA_ROOT=media.name)
        media_settings.enable()
        self.addCleanup(media_settings.disable)
        self.valid_scope = {
            "crops": ["香蕉"],
            "years": [112],
            "metrics": ["產量"],
        }

    @staticmethod
    def run_url(public_id) -> str:
        return reverse("table_compare:comparing", kwargs={"public_id": public_id})

    def test_pending_job_runs_real_files_and_persists_result_before_success(self) -> None:
        job, compare_job = create_compare_job(
            with_files=True,
            excel_content=make_run_xlsx_bytes(value=10),
            pdf_content=make_run_pdf_bytes(value=10),
        )

        response = self.client.post(
            self.run_url(job.public_id),
            self.valid_scope,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
        payload = response.json()
        self.assertEqual(set(payload), {"data", "message", "meta"})
        self.assertEqual(payload["data"]["row_count"], 1)
        self.assertEqual(
            payload["data"]["rows"],
            [{
                "crop": "香蕉",
                "year": 112,
                "metric": "產量",
                "pdf_unit": "公噸",
                "excel_unit": "公噸",
                "pdf_value": "10",
                "excel_value": "10",
                "status": "相同",
            }],
        )

        job.refresh_from_db()
        compare_job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.SUCCEEDED)
        self.assertEqual(job.error_code, "")
        self.assertEqual(compare_job.result_data["row_count"], 1)
        self.assertEqual(compare_job.result_data["scope"], self.valid_scope)
        self.assertEqual(
            compare_job.result_data["issues"],
            DEFAULT_PREVIEW["issues"],
        )
        raw_row = compare_job.result_data["rows"][0]
        self.assertEqual(raw_row["作物"], "香蕉")
        self.assertEqual(raw_row["年度"], 112)
        self.assertEqual(raw_row["數值_pdf"], "10")
        self.assertEqual(raw_row["數值_excel"], 10)
        self.assertEqual(raw_row["比對結果"], "相同")

    def test_invalid_scope_payloads_leave_job_pending_without_result(self) -> None:
        job, compare_job = create_compare_job()
        invalid_payloads = (
            {"years": [112], "metrics": ["產量"]},
            {"crops": [], "years": [112], "metrics": ["產量"]},
            {"crops": "香蕉", "years": [112], "metrics": ["產量"]},
            {"crops": ["香蕉"], "years": ["不是年度"], "metrics": ["產量"]},
            {"crops": ["香蕉"], "years": [112], "metrics": ["未知指標"]},
        )

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(
                    self.run_url(job.public_id),
                    payload,
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(response.json()["code"], "invalid_scope")
                self.assertTrue(response.json()["field_errors"])
                job.refresh_from_db()
                compare_job.refresh_from_db()
                self.assertEqual(job.status, Job.Status.PENDING)
                self.assertIsNone(compare_job.result_data)

    def test_options_outside_preview_are_rejected_before_job_is_claimed(self) -> None:
        invalid_scopes = (
            {"crops": ["茶"], "years": [112], "metrics": ["產量"]},
            {"crops": ["香蕉"], "years": [113], "metrics": ["產量"]},
            {"crops": ["香蕉"], "years": [112], "metrics": ["產值"]},
        )

        for scope in invalid_scopes:
            with self.subTest(scope=scope):
                job, compare_job = create_compare_job()
                response = self.client.post(
                    self.run_url(job.public_id),
                    scope,
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(response.json()["code"], "invalid_comparison")
                job.refresh_from_db()
                compare_job.refresh_from_db()
                self.assertEqual(job.status, Job.Status.PENDING)
                self.assertIsNone(compare_job.result_data)

    def test_missing_or_other_kind_job_returns_not_found_without_changes(self) -> None:
        other_job = Job.objects.create(
            kind=Job.Kind.VOLUME_PRICE_MERGE,
            status=Job.Status.PENDING,
            expires_at=timezone.now() + timedelta(hours=1),
        )

        for public_id in (uuid4(), other_job.public_id):
            with self.subTest(public_id=public_id):
                response = self.client.post(
                    self.run_url(public_id),
                    self.valid_scope,
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
                self.assertEqual(response.json()["code"], "job_not_found")

        other_job.refresh_from_db()
        self.assertEqual(other_job.status, Job.Status.PENDING)

    def test_non_pending_jobs_are_not_recomputed_or_overwritten(self) -> None:
        original_result = {"sentinel": "keep"}
        for job_status in (
            Job.Status.RUNNING,
            Job.Status.SUCCEEDED,
            Job.Status.FAILED,
        ):
            with self.subTest(status=job_status):
                job, compare_job = create_compare_job(
                    status=job_status,
                    result_data=original_result,
                )
                response = self.client.post(
                    self.run_url(job.public_id),
                    self.valid_scope,
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
                self.assertEqual(response.json()["code"], "job_not_runnable")
                job.refresh_from_db()
                compare_job.refresh_from_db()
                self.assertEqual(job.status, job_status)
                self.assertEqual(compare_job.result_data, original_result)

    def test_expired_job_persists_expired_status(self) -> None:
        job, compare_job = create_compare_job(expired=True)

        response = self.client.post(
            self.run_url(job.public_id),
            self.valid_scope,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertEqual(response.json()["code"], "job_expired")
        job.refresh_from_db()
        compare_job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.EXPIRED)
        self.assertIsNone(compare_job.result_data)

    def test_unexpected_failure_marks_job_failed_without_leaking_details(self) -> None:
        job, compare_job = create_compare_job()
        secret = "internal-path-C:/private/traceback-value"

        with patch.object(
            ComparingService,
            "_build_result",
            side_effect=RuntimeError(secret),
        ):
            response = self.client.post(
                self.run_url(job.public_id),
                self.valid_scope,
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(response.json()["code"], "comparison_failed")
        serialized = json.dumps(response.json(), ensure_ascii=False)
        self.assertNotIn(secret, serialized)
        self.assertNotIn("Traceback", serialized)
        job.refresh_from_db()
        compare_job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.FAILED)
        self.assertEqual(job.error_code, "comparison_failed")
        self.assertIsNone(compare_job.result_data)

    def test_result_save_failure_rolls_back_result_and_marks_job_failed(self) -> None:
        job, compare_job = create_compare_job()
        result = {
            "row_count": 1,
            "rows": [{
                "作物": "香蕉",
                "年度": 112,
                "指標": "產量",
                "單位_pdf": "公噸",
                "單位_excel": "公噸",
                "數值_pdf": 10,
                "數值_excel": 10,
                "比對結果": "相同",
            }],
        }

        with (
            patch.object(ComparingService, "_build_result", return_value=result),
            patch.object(
                TableCompareJob,
                "save",
                side_effect=RuntimeError("result insert failed"),
            ),
        ):
            response = self.client.post(
                self.run_url(job.public_id),
                self.valid_scope,
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(response.json()["code"], "comparison_failed")
        job.refresh_from_db()
        compare_job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.FAILED)
        self.assertEqual(job.error_code, "comparison_failed")
        self.assertIsNone(compare_job.result_data)

    @patch("apps.table_compare.api.services.comparing_service.PDFTableAdapter")
    @patch("apps.table_compare.api.services.comparing_service.ExcelTableAdapter")
    def test_differences_missing_units_markers_and_zero_still_succeed(
        self,
        excel_adapter,
        pdf_adapter,
    ) -> None:
        crops = ["香蕉", "鳳梨", "茶", "小麥", "芒果", "番石榴", "蓮霧"]
        preview = {
            **DEFAULT_PREVIEW,
            "crops": crops,
            "defaults": {**DEFAULT_PREVIEW["defaults"], "crops": crops},
        }
        job, _compare_job = create_compare_job(preview=preview, with_files=True)
        excel_adapter.return_value.load.return_value = make_frame([
            ["果品", "香蕉", 112, "產量", "公噸", 10],
            ["果品", "鳳梨", 112, "產量", "公噸", 20],
            ["特作", "茶", 112, "產量", "公噸", 30],
            ["果品", "芒果", 112, "產量", "公斤", 10],
            ["果品", "番石榴", 112, "產量", "公噸", "…"],
            ["果品", "蓮霧", 112, "產量", "公噸", 0],
        ])
        pdf_adapter.return_value.load.return_value = make_frame([
            ["果品", "香蕉", 112, "產量", "公噸", 10],
            ["果品", "鳳梨", 112, "產量", "公噸", 21],
            ["雜糧", "小麥", 112, "產量", "公噸", 40],
            ["果品", "芒果", 112, "產量", "公噸", 10],
            ["果品", "番石榴", 112, "產量", "公噸", 0],
            ["果品", "蓮霧", 112, "產量", "公噸", 0],
        ])

        response = self.client.post(
            self.run_url(job.public_id),
            {**self.valid_scope, "crops": crops},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
        statuses = {
            row["crop"]: row["status"] for row in response.json()["data"]["rows"]
        }
        self.assertEqual(statuses["香蕉"], "相同")
        self.assertEqual(statuses["鳳梨"], "數值不同")
        self.assertEqual(statuses["茶"], "PDF 缺少資料")
        self.assertEqual(statuses["小麥"], "Excel 缺少資料")
        self.assertEqual(statuses["芒果"], "單位不同")
        self.assertEqual(statuses["番石榴"], "缺值／標記，暫不比對")
        self.assertEqual(statuses["蓮霧"], "相同")
        zero_row = next(
            row for row in response.json()["data"]["rows"]
            if row["crop"] == "蓮霧"
        )
        self.assertEqual(float(zero_row["pdf_value"]), 0)
        self.assertEqual(float(zero_row["excel_value"]), 0)
        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.SUCCEEDED)

    @patch("apps.table_compare.api.services.comparing_service.PDFTableAdapter")
    @patch("apps.table_compare.api.services.comparing_service.ExcelTableAdapter")
    def test_duplicate_only_outside_selected_scope_does_not_block_run(
        self,
        excel_adapter,
        pdf_adapter,
    ) -> None:
        job, _compare_job = create_compare_job(with_files=True)
        excel_adapter.return_value.load.return_value = make_frame([
            ["果品", "香蕉", 112, "產量", "公噸", 10],
            ["特作", "茶", 112, "產量", "公噸", 30],
            ["特作", "茶", 112, "產量", "公噸", 31],
        ])
        pdf_adapter.return_value.load.return_value = make_frame([
            ["果品", "香蕉", 112, "產量", "公噸", 10],
        ])

        response = self.client.post(
            self.run_url(job.public_id),
            self.valid_scope,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["data"]["row_count"], 1)
        job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.SUCCEEDED)

    @patch("apps.table_compare.api.services.comparing_service.PDFTableAdapter")
    @patch("apps.table_compare.api.services.comparing_service.ExcelTableAdapter")
    def test_selected_duplicate_is_controlled_error_and_failed_job(
        self,
        excel_adapter,
        pdf_adapter,
    ) -> None:
        job, compare_job = create_compare_job(with_files=True)
        excel_adapter.return_value.load.return_value = make_frame([
            ["果品", "香蕉", 112, "產量", "公噸", 10],
            ["果品", "香蕉", 112, "產量", "公噸", 11],
        ])
        pdf_adapter.return_value.load.return_value = make_frame([
            ["果品", "香蕉", 112, "產量", "公噸", 10],
        ])

        response = self.client.post(
            self.run_url(job.public_id),
            self.valid_scope,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["code"], "invalid_comparison")
        job.refresh_from_db()
        compare_job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.FAILED)
        self.assertIsNone(compare_job.result_data)

    @patch("apps.table_compare.api.services.comparing_service.PDFTableAdapter")
    @patch("apps.table_compare.api.services.comparing_service.ExcelTableAdapter")
    def test_valid_scope_with_no_actual_records_is_controlled_error(
        self,
        excel_adapter,
        pdf_adapter,
    ) -> None:
        job, compare_job = create_compare_job(with_files=True)
        outside = make_frame([
            ["果品", "鳳梨", 112, "產量", "公噸", 10],
        ])
        excel_adapter.return_value.load.return_value = outside
        pdf_adapter.return_value.load.return_value = outside.copy()

        response = self.client.post(
            self.run_url(job.public_id),
            self.valid_scope,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["code"], "invalid_comparison")
        self.assertIn("沒有可比對資料", response.json()["message"])
        job.refresh_from_db()
        compare_job.refresh_from_db()
        self.assertEqual(job.status, Job.Status.FAILED)
        self.assertIsNone(compare_job.result_data)

    def test_run_schema_declares_json_scope_uuid_and_all_responses(self) -> None:
        schema = SchemaGenerator().get_schema(request=None, public=True)

        def resolve(value):
            while "$ref" in value:
                value = schema["components"]["schemas"][
                    value["$ref"].split("/")[-1]
                ]
            return value

        operation = schema["paths"][
            "/api/v1/table-compare/jobs/{public_id}/run/"
        ]["post"]
        path_parameter = next(
            parameter for parameter in operation["parameters"]
            if parameter["name"] == "public_id"
        )
        self.assertEqual(path_parameter["in"], "path")
        self.assertEqual(path_parameter["schema"]["format"], "uuid")

        request = resolve(
            operation["requestBody"]["content"]["application/json"]["schema"]
        )
        self.assertEqual(
            set(request["required"]),
            {"crops", "years", "metrics"},
        )
        self.assertEqual(request["properties"]["crops"]["type"], "array")
        self.assertEqual(
            request["properties"]["crops"]["items"]["type"],
            "string",
        )
        self.assertEqual(request["properties"]["years"]["type"], "array")
        self.assertEqual(
            request["properties"]["years"]["items"]["type"],
            "integer",
        )
        self.assertEqual(request["properties"]["metrics"]["type"], "array")
        self.assertEqual(
            set(operation["responses"]),
            {"200", "400", "404", "409", "410", "500"},
        )
        success = resolve(
            operation["responses"]["200"]["content"]["application/json"]["schema"]
        )
        self.assertEqual(
            set(success["properties"]),
            {"data", "message", "meta"},
        )
        data = resolve(success["properties"]["data"])
        self.assertEqual(set(data["properties"]), {"row_count", "rows"})
        row = resolve(data["properties"]["rows"]["items"])
        self.assertEqual(
            set(row["properties"]),
            {
                "crop", "year", "metric", "pdf_unit", "excel_unit",
                "pdf_value", "excel_value", "status",
            },
        )
