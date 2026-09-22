import uuid
from pathlib import Path

from django.db import models


# Create your models here.
def merge_input_path(instance, filename):
    suffix = Path(filename).suffix.lower()
    return (
        f"jobs/{instance.merge_job_id}/inputs/"
        f"{instance.role}/{uuid.uuid4().hex}{suffix}"
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
    """
     # Define custom choices for specfic column
    class Role(models.TextChoices):
        PRODUCTION = ("production", "產量及產值")
        AREA = ("area", "種植及收穫面積")

    merge_job = models.ForeignKey(VolumePriceMergeJob, on_delete=models.CASCADE, related_name="input_files",)

    # Set custom choices to particular column
    role = models.CharField(max_length=16, choices=Role.choices)
    major_category = models.CharField(max_length=100)

    original_name = models.CharField(max_length=255)
    file = models.FileField(upload_to=merge_input_path, max_length=500,)
    size_bytes = models.PositiveBigIntegerField()

    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["merge_job", "role", "major_category"],
                name="uq_merge_file_role_category",
            )
        ]