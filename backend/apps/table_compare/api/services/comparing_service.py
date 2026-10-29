"""
Duty on comparing name production_files and area_files
Check if it got prerequisite of merging file together.
"""

from typing import Literal

import pandas as pd
from django.core.files.uploadedfile import UploadedFile

from ..handlers.adapters.excel_table_adapter import ExcelTableAdapter
from ..handlers.adapters.pdf_table_adapter import PDFTableAdapter
from ..handlers.normalization import clean_label, normalize_crop_name
from ..handlers.table_comparactor import TableComparactor


from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.jobs.models import Job
# from ...models import MergeInputFile, VolumePriceMergeJob


import json
from uuid import UUID

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone

from apps.jobs.models import Job
from ...models import CompareInputFile, TableCompareJob





# create specific type to resctrict the type of argument
PROPERTY_TYPE = Literal["production", "area"]
SUPPORTED_METRICS = ("產量", "產值", "種植面積", "收穫面積")


class ComparingService:

    def __init__(self):
        self._table_comparactor = TableComparactor()


    def run(self, public_id: UUID, *, crops, years, metrics) -> dict:
        scope = {
            "crops": crops,
            "years": years,
            "metrics": metrics,
        }

        # 檢查工作與條件，並取得本次執行資格。
        job = self._claim_job(public_id, scope, Job.Status.PENDING)

        try:
            result = self._build_result(job, scope)

            # 保存實際執行條件與原本的解析提醒。
            result_data = {
                **result,
                "scope": scope,
                "issues": job.table_compare.preview.get("issues", []),
            }

            # Decimal 轉成字串，避免直接存入 JSONField 失敗。
            # 和目前 output serializer 的數值 CharField 相容。
            result_data = json.loads(
                json.dumps(
                    result_data,
                    cls=DjangoJSONEncoder,
                    allow_nan=False,
                )
            )

            with transaction.atomic():
                compare_job = TableCompareJob.objects.get(job_id=job.pk)
                compare_job.result_data = result_data
                compare_job.save(update_fields=["result_data"])

                job.status = Job.Status.SUCCEEDED
                job.error_code = ""
                job.error_message = ""
                job.save(update_fields=[
                    "status",
                    "error_code",
                    "error_message",
                    "updated_at",
                ])

            return result_data

        except Exception:
            Job.objects.filter(
                pk=job.pk,
                status=Job.Status.RUNNING,
            ).update(
                status=Job.Status.FAILED,
                error_code="comparison_failed",
                error_message="比對處理失敗。",
                updated_at=timezone.now(),
            )
            raise


    def _build_result(self, job: Job, scope: dict) -> dict:
        # Collect the resources and their file type
        input_files = {
            item.file_type: item
            for item in CompareInputFile.objects.filter(
                compare_job_id=job.pk,
            )
        }

        if set(input_files) != {"excel", "pdf"}:
            raise ComparisonInputError("工作缺少 Excel 或 PDF 來源檔。")

        # 透過 Django storage 開啟檔案，不依賴本機絕對路徑。
        with (
            input_files["excel"].file.open("rb") as excel_file,
            input_files["pdf"].file.open("rb") as pdf_file,
        ):
            return self._compare(
                excel_file=excel_file,
                pdf_file=pdf_file,
                **scope,
            )



    def _claim_job(self, public_id: UUID, scope: dict, required_status: str) -> Job:
        """
        Get pending job
        then modify its status depends on expiration date etc.
        """
        job_error: CompareJobError | None = None

        with transaction.atomic():
            # Look for specific ORM object filtered by mutiple condition from filter()/get() = WHERE in SQL syntax.
            # select_for_update():
            # the selected entries(ORM objects) will be locked that another request can NOT modify corresponding entries until this transaction is finished.
            job = Job.objects.select_for_update().get(public_id = public_id, kind = Job.Kind.TABLE_COMPARE, )
            
            if job.expires_at <= timezone.now():
                # If it's out of date -> expired and raise error
                job.status = Job.Status.EXPIRED
                job.save(update_fields=["status", "updated_at"])
                job_error = ComparisonJobExpired()
            elif job.status != required_status:
                # If it's not pending job -> raise error 
                job_error = ComparisonJobNotRunnable()
            else:
                if required_status == Job.Status.PENDING:
                    # 不能只相信前端選項，後端也驗證所選範圍。
                    preview = job.table_compare.preview

                    for field, selected in scope.items():
                        available = preview.get(field, [])

                        if not selected or not set(selected).issubset(available):
                            raise ComparisonInputError(
                                f"{field} 包含不在此工作預覽範圍內的選項。"
                            )
                    # Normal pending condition -> change to running. If it's succeeded conidtion -> do nothing.
                    job.status = Job.Status.RUNNING
                    job.save(update_fields=["status", "updated_at"])
                    
    
        if job_error is not None:
            raise job_error
        return job



    def _compare(self, excel_file, pdf_file, **scope):
        excel_file.seek(0)
        pdf_file.seek(0)

        excel_df = ExcelTableAdapter(excel_file).load()
        pdf_df = PDFTableAdapter(pdf_file).load()


        if excel_df.empty and pdf_df.empty:
            raise ComparisonInputError("選定範圍沒有可比對資料。")

        # 第一版先阻止有歧義的資料進行比對
        # 檢查本次選定範圍
        has_selected_records = False
        for source, frame in [("Excel", excel_df), ("PDF", pdf_df)]:
            selected = frame.loc[
                frame["作物"].isin(scope["crops"])
                & frame["年度"].isin(scope["years"])
                & frame["指標"].isin(scope["metrics"])
            ]

            if not selected.empty:
                has_selected_records = True

            if selected.duplicated(self._table_comparactor.KEYS).any():
                raise ComparisonInputError(
                    f"{source} 的選定範圍出現重複比對鍵，請先確認來源資料。"
                )

        if not has_selected_records:
            raise ComparisonInputError("選定範圍沒有可比對資料。")


        result = self._table_comparactor.start_comparing(excel_df, pdf_df, **scope)

        # outer merge 產生的 NaN 改成 None
        cleaned = result.astype(object).where(result.notna(), None)

        return {
            "row_count": len(result),
            "rows": cleaned.to_dict("records"),
        }


    def get_workbook(self, public_id: UUID, product: str) -> dict:
        """
        Create workbook depended on merged result in specific job.
        """
        # Check if job is succeeded to extract.
        job = self._claim_job(public_id, Job.Status.SUCCEEDED)
        # Get MergeJob for accessing result data 
        compare_job = TableCompareJob.objects.get(job_id=job.pk)
        # Then track to all input files of specific MergeJob to obtain information of input file
        source_file_count = CompareInputFile.objects.filter(merge_job=compare_job,).count()


        workbook_result_bytes = None
        # Check if there is query condition for product or not

        workbook_result_bytes = self.__excel_handler.build_workbook(compare_job.result_data, compare_job.pairing_preview, source_file_count= source_file_count)


        # Set download file information
        # download time: need to use local time instead of UTC time. 
        # timezone.now() -> UTC time; localtime() -> local time base on settings ex: Taipiei
        date_prefix = self.__RE_handler.format_roc_date(timezone.localdate())
        file_name = f"合併結果_{product}.xlsx" if product else "合併結果.xlsx" 
        file_name = date_prefix + file_name
    

        return {
            "file_name": self.__RE_handler.safe_filename(file_name),
            "file_buffer": workbook_result_bytes,
        }



class ComparisonInputError(ValueError):
    pass


class CompareJobError(Exception):
    pass


class ComparisonJobExpired(CompareJobError):
    pass


class ComparisonJobNotRunnable(CompareJobError):
    pass
