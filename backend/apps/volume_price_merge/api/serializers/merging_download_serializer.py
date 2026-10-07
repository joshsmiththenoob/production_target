from rest_framework import serializers

from apps.jobs.models import Job



class MergeDownloadRequestSerializer(serializers.Serializer):
    product = serializers.CharField(required=False)
