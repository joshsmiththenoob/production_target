"""
In charge of Merging prudction/area files based on category - year - product name
"""
from typing import Any
from uuid import UUID

from django.core.files.uploadedfile import UploadedFile
from django.shortcuts import get_object_or_404

from ..handlers.workbook_reader import WorkbookReader
from ..handlers.category_recognizer import CategoryRecognizer
from ..handlers.pair_validator import PairValidator
from ..handlers.excel_handler import ExcelHandler

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.jobs.models import Job
from ...models import MergeInputFile, VolumePriceMergeJob



class MergingService:
    def __init__(self):
        self.__work_book_reader = WorkbookReader()
        self.__excel_handler = ExcelHandler()


    def run(self, public_id: UUID) -> dict[str, Any]:
        job = self.__claim_pending_job(public_id)

        try:
            result_data = self._build_result(job)

            with transaction.atomic():
                merge_job = VolumePriceMergeJob.objects.select_for_update().get(job_id=job.pk)
               
                merge_job.result_data = result_data
                merge_job.save(update_fields=["result_data"])

                # job.status = Job.Status.SUCCEEDED
                # job.error_code = ""
                # job.error_message = ""
                # job.save(
                #     update_fields=[
                #         "status",
                #         "error_code",
                #         "error_message",
                #         "updated_at",
                #     ]
                # )

            return result_data

        except Exception:
            # Job.objects.filter(pk=job.pk,status=Job.Status.RUNNING,).update(
            #                                                             status=Job.Status.FAILED,
            #                                                             error_code="merge_failed",
            #                                                             error_message="合併處理失敗。",
            #                                                         )
            pass
            raise 


    def _build_result(self, job: Job):
        # Check if status of Job is pending(ready) or not though interal primary key of Job ORM Object
        input_files = MergeInputFile.objects.filter(merge_job_id=job.pk).order_by("id")


        all_normalized_files = []
    
        for input_file in input_files:
            input_file.file.open("rb")
            try: 
                rows = self.__work_book_reader.read_rows(input_file.file, file_name= input_file.original_name)
                # Get indexes of row about year, product and start point of datatset
                normalized_file = self.__excel_handler.normalize_input(rows, input_file.major_category, input_file.property_type, input_file.original_name)
                all_normalized_files.append(normalized_file)

            finally:
                input_file.file.close()




        # 1. Get column order of all_normalized_files
        column_order = self.__excel_handler.build_column_order(all_normalized_files)
        if not column_order:
            raise ValueError("Can't find mergable column of year and product.")

        # 2. Then merge rows which depend on same column name
        merged_rows = self.__excel_handler.build_merged_rows(all_normalized_files, column_order)
        if not merged_rows:
            raise ValueError("Can't find any mergable rows in dataset.")
        
        # print(merged_rows)

        # 3. Build response data
        result_data = self.__excel_handler.build_result_data(column_order, merged_rows)

        return result_data


    def __claim_pending_job(self, public_id: UUID):
        """
        Get and Process the pending job
        """
        with transaction.atomic():
            # Look for specific ORM object filtered by mutiple condition from filter()/get() = WHERE in SQL syntax.
            # select_for_update():
            # the selected entries(ORM objects) will be locked that another request can NOT modify corresponding entries until this transaction is finished.
            job = Job.objects.select_for_update().get(public_id = public_id, kind = Job.Kind.VOLUME_PRICE_MERGE, )
            
            if (job.expires_at <= timezone.now()):
                job.status = Job.Status.EXPIRED
                job.save(update_fields=["status", "created_at"])
                raise ValueError("The job is expired.")

            if job.status != Job.Status.PENDING:
                raise ValueError("The job can NOT be executed.")
            
            job.status = Job.Status.RUNNING
            job.save(update_fields=["status", "created_at"])

        return job
            