from rest_framework import serializers

class MergingDownloadRequestSerializer(serializers.Serializer):
    product = serializers.CharField(default="", allow_blank=True, trim_whitespace=True)


# class MergingDownloadSerializer(serializers.Serializer):
#     public_id = serializers.UUIDField()
#     download_file = serializers.FileField(allow_null=True)
    
    
# class MergingDownloaResponseSerializer(serializers.Serializer):
#     data = MergingDownloadSerializer()
#     message = serializers.CharField()
#     meta = serializers.DictField(allow_null=True, required=False)

