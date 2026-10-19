from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

class MergeResultRequestSerializer(serializers.Serializer):
    product = serializers.CharField(allow_blank=False, trim_whitespace=True)


@extend_schema_field(
    {
        "oneOf": [{"type": "number"}, {"type": "string"}],
        "nullable": True,
    }
)
class MergeResultValueField(serializers.Field):
    default_error_messages = {
        "invalid": "Result values must be a number, string, or null.",
    }

    def to_internal_value(self, data):
        if data is None or (
            isinstance(data, (int, float, str)) and not isinstance(data, bool)
        ):
            return data
        self.fail("invalid")

    def to_representation(self, value):
        return value


class MergeResultColumnSerializer(serializers.Serializer):
    key = serializers.CharField()
    major_category = serializers.CharField()
    year = serializers.CharField()
    crop = serializers.CharField()


class MergeResultRowSerializer(serializers.Serializer):
    metric = serializers.CharField()
    values = serializers.ListField(
        child=MergeResultValueField(allow_null=True),
    )
    

class MergeResultQuerybyProductSerializer(serializers.Serializer):
    product = serializers.CharField()
    columns = MergeResultColumnSerializer(many=True)
    rows = MergeResultRowSerializer(many=True)

    
class MergeResultDataSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()
    query_result = MergeResultQuerybyProductSerializer()


class MergeResultResponseSerializer(serializers.Serializer):
    data = MergeResultDataSerializer()
    message = serializers.CharField()
    meta = serializers.DictField(allow_null=True, required=False)
