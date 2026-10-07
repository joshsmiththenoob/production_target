from rest_framework import serializers

from apps.jobs.models import Job

class MergeResultRequestSerializer(serializers.Serializer):
    product = serializers.CharField()


class MergeResultColumnSerializer(serializers.Serializer):
    key = serializers.CharField()
    major_category = serializers.CharField()
    year = serializers.CharField()
    crop = serializers.CharField()


class MergeResultRowSerializer(serializers.Serializer):
    metric = serializers.CharField()
    values = serializers.ListField(
    child=serializers.FloatField(allow_null=True),
)
    

class MergeResultQuerybyProductSerializer(serializers.Serializer):
    product = serializers.CharField()
    columns = serializers.ListField(child=MergeResultColumnSerializer(
                                                    allow_null=True, 
                                                    required=False)
                                                                )
    rows = serializers.ListField(child=MergeResultRowSerializer(
                                                    allow_null=True, 
                                                    required=False)
                                                                )

    
class MergeResultDataSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    query_result = MergeResultQuerybyProductSerializer()


class MergeResultResponseSerializer(serializers.Serializer):
    data = MergeResultDataSerializer()
    message = serializers.CharField()
    meta = serializers.DictField(allow_null=True, required=False)
