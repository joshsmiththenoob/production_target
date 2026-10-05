from rest_framework import serializers

from apps.jobs.models import Job


class MergeResultRequestSerializer(serializers.Serializer):
    product = serializers.CharField()