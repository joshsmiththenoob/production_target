"""
In charge of Merging prudction/area files based on category - year - product name
"""
from typing import Any
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from apps.jobs.models import Job

from ...models import MergeInputFile, VolumePriceMergeJob
from ..handlers.excel_handler import ExcelHandler
from ..handlers.workbook_reader import WorkbookReader


class MergingService:
    def __init__(self):
        self.__work_book_reader = WorkbookReader()
        self.__excel_handler = ExcelHandler()


    def run(self, public_id: UUID) -> dict[str, Any]:
        
        # Check if job's status is pending, then change its status and extract it
        job = self._claim_job(public_id, Job.Status.PENDING)

        try:
            result_data = self._build_result(job)

            with transaction.atomic():
                # Save result to merge job
                merge_job = VolumePriceMergeJob.objects.select_for_update().get(job_id=job.pk)
               
                merge_job.result_data = result_data
                merge_job.save(update_fields=["result_data"])


                # Then change status of job succeeded 
                job.status = Job.Status.SUCCEEDED
                job.error_code = ""
                job.error_message = ""
                job.save(
                    update_fields=[
                        "status",
                        "error_code",
                        "error_message",
                        "updated_at",
                    ]
                )


                result_summary_response = {
                    "public_id": job.public_id,
                    "status": job.status,
                    "summary": {
                        "column_count": result_data["summary"]["column_count"],
                        "row_count": result_data["summary"]["row_count"],
                        "available_crops": result_data["available_crops"],
                    },
                }

            return result_summary_response

        except Exception:
            Job.objects.filter(
                pk=job.pk,
                status=Job.Status.RUNNING,
            ).update(
                status=Job.Status.FAILED,
                error_code="merge_failed",
                error_message="合併處理失敗。",
                updated_at=timezone.now(),
            )
            raise


    def _build_result(self, job: Job) -> dict[str, Any]:
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
        
        # 3. Build response data
        result_data = self.__excel_handler.build_result_data(column_order, merged_rows)


        return result_data


    # def _claim_pending_job(self, public_id: UUID) -> Job:
    #     """
    #     Get pending job
    #     then modify its status depends on expiration date etc.
    #     """
    #     job_error: MergeJobError | None = None

    #     with transaction.atomic():
    #         # Look for specific ORM object filtered by mutiple condition from filter()/get() = WHERE in SQL syntax.
    #         # select_for_update():
    #         # the selected entries(ORM objects) will be locked that another request can NOT modify corresponding entries until this transaction is finished.
    #         job = Job.objects.select_for_update().get(public_id = public_id, kind = Job.Kind.VOLUME_PRICE_MERGE, )
            
    #         if job.expires_at <= timezone.now():
    #             # If it's out of date -> expired and raise error
    #             job.status = Job.Status.EXPIRED
    #             job.save(update_fields=["status", "updated_at"])
    #             job_error = MergeJobExpired()
    #         elif job.status != Job.Status.PENDING:
    #             # If it's not pending job -> raise error 
    #             job_error = MergeJobNotRunnable()
    #         else:
    #             # Normal condition -> running
    #             job.status = Job.Status.RUNNING
    #             job.save(update_fields=["status", "updated_at"])

    #     if job_error is not None:
    #         raise job_error

    #     return job


    def _claim_job(self, public_id: UUID, status= Job.Status.choices):
        """
        Get pending job
        then modify its status depends on expiration date etc.
        """
        job_error: MergeJobError | None = None

        with transaction.atomic():
            # Look for specific ORM object filtered by mutiple condition from filter()/get() = WHERE in SQL syntax.
            # select_for_update():
            # the selected entries(ORM objects) will be locked that another request can NOT modify corresponding entries until this transaction is finished.
            job = Job.objects.select_for_update().get(public_id = public_id, kind = Job.Kind.VOLUME_PRICE_MERGE, )
            
            if job.expires_at <= timezone.now():
                # If it's out of date -> expired and raise error
                job.status = Job.Status.EXPIRED
                job.save(update_fields=["status", "updated_at"])
                job_error = MergeJobExpired()
            elif job.status != status:
                # If it's not pending job -> raise error 
                job_error = MergeJobNotRunnable()
            else:
                if status == Job.Status.PENDING:
                    # Normal pending condition -> change to running. If it's succeeded conidtion -> do nothing.
                    job.status = Job.Status.RUNNING
                    job.save(update_fields=["status", "updated_at"])
                    
    
        if job_error is not None:
            raise job_error
        return job


    def query_result(self, public_id: UUID, product: str) -> None:
        """
        Get the created merged result from database
        """
        # Check if job is succeeded to extract.
        job = self._claim_job(public_id, Job.Status.SUCCEEDED)
        print(job)
        try:
            merge_job = VolumePriceMergeJob.objects.get(job_id = job.pk)
            print(merge_job.result_data)
            result_data = self._filter_by_product(merge_job.result_data, product)

            with transaction.atomic():
                pass
            

        except Exception:
            Job.objects.filter(
                pk=job.pk,
                status=Job.Status.RUNNING,
            ).update(
                status=Job.Status.FAILED,
                error_code="merge_failed",
                error_message="合併處理失敗。",
                updated_at=timezone.now(),
            )
            raise
        


# Custom Error Exception: We can create custom Error to maintain the error except default Python Error
class MergeJobError(Exception):
    pass


class MergeJobExpired(MergeJobError):
    pass


class MergeJobNotRunnable(MergeJobError):
    pass


class MergeInputInvalid(MergeJobError):
    pass
