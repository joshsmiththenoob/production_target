from pathlib import Path
from rest_framework import serializers
from apps.jobs.models import Job

class MergeRunDataSerializer(serializers.Serializer):
    """
    The Summary of merging result
    """
    column_count = serializers.IntegerField(min_value=0)
    row_count = serializers.IntegerField(min_value=0)
    available_crops = serializers.ListField(
        child=serializers.CharField(),
    )


class MergingSummaryResponseSerializer(serializers.Serializer):
    """
    Response of merging job in Step3
    -> Just return summary of merging result
    """
    public_id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=Job.Status.choices,)
    summary = MergeRunDataSerializer()





