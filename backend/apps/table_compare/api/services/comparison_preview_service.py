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




# create specific type to resctrict the type of argument
PROPERTY_TYPE = Literal["production", "area"]
SUPPORTED_METRICS = ("產量", "產值", "種植面積", "收穫面積")


class ComparisonPreviewService:

    def __init__(self):
        self._table_comparactor = TableComparactor()

    def build_preview(self, excel_file: UploadedFile, pdf_file: UploadedFile,) -> dict:
        excel_file.seek(0)
        pdf_file.seek(0)

        excel_adapter = ExcelTableAdapter(excel_file)
        pdf_adapter = PDFTableAdapter(pdf_file)

        try:
            excel_df = excel_adapter.load()
        except Exception as error:
            raise ComparisonInputError("無法解析 Excel 檔案。") from error

        try:
            pdf_df = pdf_adapter.load()
        except Exception as error:
            raise ComparisonInputError("無法解析 PDF 檔案。") from error

        # Get crops 
        crops = self._ordered_unique_crops(excel_df["作物"])
        pdf_crops = self._ordered_unique_crops(pdf_df["作物"])
        years = sorted(
            self._normalized_years(excel_df["年度"])
            & self._normalized_years(pdf_df["年度"])
        )
        excel_metrics = {
            clean_label(str(value))
            for value in excel_df["指標"]
            if not pd.isna(value)
        }
        metrics = [
            metric for metric in SUPPORTED_METRICS
            if metric in excel_metrics
        ]

        issues = [
            (
                f"目前的 PDF 解析結果未找到作物「{crop}」；"
                "這不代表來源 PDF 沒有資料。"
            )
            for crop in crops
            if crop not in pdf_crops
        ]

        for skipped_page in pdf_adapter.skipped_pages:
            page_number = skipped_page.get("頁碼")
            reason = skipped_page.get("原因") or "未知原因"
            issues.append(f"PDF 第 {page_number} 頁未解析：{reason}")

        if not years:
            issues.append("Excel 與 PDF 沒有共同實績年度。")
        if not crops:
            issues.append("Excel 解析資料中沒有可供預覽的作物。")
        if not metrics:
            issues.append("Excel 解析資料中沒有支援的比對指標。")

        # Default selected option for React to represent so that client will request all crops by default.
        defaults = {
            "crops": list(crops),
            "years": list(years),
            "metrics": list(metrics),
        }

        return {
            "crops": crops,
            "years": years,
            "metrics": metrics,
            "defaults": defaults,
            "issues": issues,
        }

    @staticmethod
    def _ordered_unique_crops(values) -> list[str]:
        """
        Get unique crops by
        1. Check if it's None
        2. Normalize crop name
        3. Have seen it before? No -> append to crop list
        4. return crop list
        """
        crops = []
        seen = set()

        for value in values:
            if pd.isna(value):
                continue
            crop = normalize_crop_name(str(value))
            if not crop or crop in seen:
                continue
            seen.add(crop)
            crops.append(crop)

        return crops

    @staticmethod
    def _normalized_years(values) -> set[int]:
        """
        Get unique years, its method also is similar to ordered_unique_crops() above.
        """
        years = set()

        for value in values:
            if pd.isna(value):
                continue
            try:
                years.add(int(value))
            except (TypeError, ValueError):
                continue

        return years




class ComparisonJobCreationService:
    @transaction.atomic
    def create(self, preview, file_infos, owner=None):
        # Create job for management
        job = Job.objects.create(
            kind=Job.Kind.TABLE_COMPARE,
            status=Job.Status.PENDING,
            owner=owner,
            expires_at=timezone.now() + timedelta(hours=24),
        )

        # Create description of specific bussiness relate the job we created above
        merge_job = VolumePriceMergeJob.objects.create(
            job=job,
            pairing_preview=preview,
        )


        # In that bussiness, we got mutiple input files to result in that bussiness
        # Need to create every information of input files related to corresponding bussiness
        for info in file_infos:
            uploaded_file = info["uploaded_file"]
            uploaded_file.seek(0)

            MergeInputFile.objects.create(
                merge_job=merge_job,
                property_type=info["property_type"],
                major_category=info["major_category"],
                original_name=uploaded_file.name,
                file=uploaded_file,
                size_bytes=uploaded_file.size,
            )

#         return job





class ComparisonInputError(ValueError):
    pass
