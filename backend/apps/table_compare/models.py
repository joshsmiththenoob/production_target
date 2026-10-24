import uuid
from pathlib import Path

from django.db import models


# Create your models here.
def compare_input_path(instance, filename):
    # Define the actul file path based on job id and file_type
    suffix = Path(filename).suffix.lower()
    return (
        f"jobs/{instance.compare_job_id}/inputs/"
        f"{instance.property_type}/{uuid.uuid4().hex}{suffix}"
    )



def merge_output_path(instance, filename):
    return f"jobs/{instance.job_id}/output/{uuid.uuid4().hex}.xlsx"

class TableCompareJob(models.Model):
    """
    Description of job only
    """
    job = models.OneToOneField("jobs.Job", primary_key=True, on_delete=models.CASCADE, related_name="table_compare",)
    preview = models.JSONField(default=dict)
    result_data = models.JSONField(null=True, blank=True)

class CompareInputFile(models.Model):
    """
    The origin input files will lead to 1 result of merge job
    """
     # Define custom choices for specfic column
    class FileType(models.TextChoices):
        EXCEL = ("excel", "合併 Excel")
        PDF = ("pdf", "核對 PDF")

    compare_job = models.ForeignKey(TableCompareJob, on_delete=models.CASCADE, related_name="input_files",)

    # Set custom choices to particular column
    file_type = models.CharField(max_length=16, choices=FileType.choices)

    # File informations 
    # Original file_name
    original_name = models.CharField(max_length=255)
    # upload_to arugument: save the file on relative path created by callable function.
    # Note: The file will be saved in MEDIA_ROOT/relativ_path thanks to functionality of models.FileField
    # then only save string path to table in PostgreSQL
    file = models.FileField(upload_to=compare_input_path, max_length=500,)
    size_bytes = models.PositiveBigIntegerField()

    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["compare_job", "file_type"],
                name="uq_compare_job_file_type",
            )
        ]