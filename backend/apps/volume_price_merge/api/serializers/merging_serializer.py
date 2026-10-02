from rest_framework import serializers

from apps.jobs.models import Job


class MergeSummarySerializer(serializers.Serializer):
    """
    The Summary of merging result
    """
    column_count = serializers.IntegerField(min_value=0)
    row_count = serializers.IntegerField(min_value=0)
    available_crops = serializers.ListField(
        child=serializers.CharField(),
    )


class MergingSummaryDataSerializer(serializers.Serializer):
    """
    Response of merging job in Step3
    -> Just return summary of merging result
    """
    public_id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=Job.Status.choices)
    summary = MergeSummarySerializer()


class MergingSummaryResponseSerializer(serializers.Serializer):
    data = MergingSummaryDataSerializer()
    message = serializers.CharField()
    meta = serializers.DictField(allow_null=True, required=False)
