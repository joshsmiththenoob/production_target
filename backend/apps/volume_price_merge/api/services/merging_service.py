"""
In charge of Merging prudction/area files based on category - year - product name
"""
import uuid


from typing import Literal

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


    def run(self, public_id:uuid):
        # Look for specific ORM object filtered by mutiple condition from filter()/get() = WHERE in SQL syntax.
        job = get_object_or_404(Job, public_id=public_id, kind=Job.Kind.VOLUME_PRICE_MERGE)

        # Check if status of Job is pending(ready) or not though interal primary key of Job ORM Object
        input_files = MergeInputFile.objects.filter(merge_job_id=job.pk).order_by("id")

        if (job.status != "pending"):
            raise ValueError("Invalid Request. The request has been either finished or failed.")
        
        
        for file in input_files:
            rows = self.__work_book_reader.read_rows(file)
            header_matrix = self.__excel_handler.detect_header_matrix_structure(rows)
            print(header_matrix)
            

        