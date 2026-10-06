from rest_framework import serializers

from apps.jobs.models import Job


class MergeResultRequestSerializer(serializers.Serializer):
    product = serializers.CharField()



class MergeResultQuerybyProduct(serializers.Serializer):
    product = serializers.CharField()
    columns = serializers.ListField(child=serializers.DictField(
                                                    allow_null=True, 
                                                    required=False)
                                                                )
    rows = serializers.ListField(child=serializers.DictField(
                                                    allow_null=True, 
                                                    required=False)
                                                                )
    
class MergeResultResponseSErializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    query_result = MergeResultQuerybyProduct()