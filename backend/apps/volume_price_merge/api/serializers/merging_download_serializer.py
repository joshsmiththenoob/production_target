from rest_framework import serializers

from apps.jobs.models import Job



class MergingDownloadRequestSerializer(serializers.Serializer):
    product = serializers.CharField(required= False, default= '')


# class MergingDownloadSerializer(serializers.Serializer):
#     public_id = serializers.UUIDField()
#     download_file = serializers.FileField(allow_null=True)
    
    
# class MergingDownloaResponseSerializer(serializers.Serializer):
#     data = MergingDownloadSerializer()
#     message = serializers.CharField()
#     meta = serializers.DictField(allow_null=True, required=False)

