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


class ComparingService:

    def __init__(self):
        self._table_comparactor = TableComparactor()


    def compare(self, excel_file, pdf_file, **scope):
        excel_file.seek(0)
        pdf_file.seek(0)

        excel_df = ExcelTableAdapter(excel_file).load()
        pdf_df = PDFTableAdapter(pdf_file).load()


        if excel_df.empty and pdf_df.empty:
            raise ComparisonInputError("選定範圍沒有可比對資料。")

        # 第一版先阻止有歧義的資料進行比對
        for source, frame in [("Excel", excel_df), ("PDF", pdf_df)]:
            if frame.duplicated(self._table_comparactor.KEYS).any():
                raise ComparisonInputError(
                    f"{source} 出現重複比對鍵，請先確認來源資料。"
                )


        result = self._table_comparactor.start_comparing(excel_df, pdf_df, **scope)

        # outer merge 產生的 NaN 改成 None
        cleaned = result.astype(object).where(result.notna(), None)

        return {
            "row_count": len(result),
            "rows": cleaned.to_dict("records"),
        }



# class MergeJobCreationService:
#     @transaction.atomic
#     def create(self, preview, file_infos, owner=None):
#         # Create job for management
#         job = Job.objects.create(
#             kind=Job.Kind.VOLUME_PRICE_MERGE,
#             status=Job.Status.PENDING,
#             owner=owner,
#             expires_at=timezone.now() + timedelta(hours=24),
#         )

#         # Create description of specific bussiness relate the job we created above
#         merge_job = VolumePriceMergeJob.objects.create(
#             job=job,
#             pairing_preview=preview,
#         )


#         # In that bussiness, we got mutiple input files to result in that bussiness
#         # Need to create every information of input files related to corresponding bussiness
#         for info in file_infos:
#             uploaded_file = info["uploaded_file"]
#             uploaded_file.seek(0)

#             MergeInputFile.objects.create(
#                 merge_job=merge_job,
#                 property_type=info["property_type"],
#                 major_category=info["major_category"],
#                 original_name=uploaded_file.name,
#                 file=uploaded_file,
#                 size_bytes=uploaded_file.size,
#             )

#         return job





class ComparisonInputError(ValueError):
    pass
