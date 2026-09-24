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


from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.jobs.models import Job
from ...models import MergeInputFile, VolumePriceMergeJob



class MergingService:
    def __init__(self):
        pass

    def run(self, public_id:uuid):
        job = get_object_or_404(
            Job,
            public_id=public_id,
            kind=Job.Kind.VOLUME_PRICE_MERGE,
        )

        # 先檢查 job.status 是否為 pending

        input_files = MergeInputFile.objects.filter(
            merge_job_id=job.pk
        ).order_by("id")