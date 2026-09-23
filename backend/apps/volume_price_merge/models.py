import uuid
from pathlib import Path

from django.db import models


# Create your models here.
def merge_input_path(instance, filename):
    suffix = Path(filename).suffix.lower()
    return (
        f"jobs/{instance.merge_job_id}/inputs/"
        f"{instance.property_type}/{uuid.uuid4().hex}{suffix}"
    )


def merge_output_path(instance, filename):
    return f"jobs/{instance.job_id}/output/{uuid.uuid4().hex}.xlsx"

class VolumePriceMergeJob(models.Model):
    """
    Description of job only
    """
    job = models.OneToOneField("jobs.Job", primary_key=True, on_delete=models.CASCADE, related_name="volume_price_merge",)
    pairing_preview = models.JSONField(default=dict)

class MergeInputFile(models.Model):
    """
    The origin input files will lead to 1 result of merge job
    """
     # Define custom choices for specfic column
    class PropertyType(models.TextChoices):
        PRODUCTION = ("production", "產量及產值")
        AREA = ("area", "種植及收穫面積")

    merge_job = models.ForeignKey(VolumePriceMergeJob, on_delete=models.CASCADE, related_name="input_files",)

    # Set custom choices to particular column
    property_type = models.CharField(max_length=16, choices=PropertyType.choices)
    major_category = models.CharField(max_length=100)

    # File informations 
    # Original file_name
    original_name = models.CharField(max_length=255)
    # upload_to arugument: save the file on relative path created by callable function.
    # Note: The file will be saved in MEDIA_ROOT/relativ_path thanks to functionality of models.FileField
    # then only save string path to table in PostgreSQL
    file = models.FileField(upload_to=merge_input_path, max_length=500,)
    size_bytes = models.PositiveBigIntegerField()

    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["merge_job", "property_type", "major_category"],
                name="uq_merge_file_role_category",
            )
        ]