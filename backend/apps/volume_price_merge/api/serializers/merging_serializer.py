from pathlib import Path
from rest_framework import serializers



class MergingSerializer(serializers.Serializer):
    public_id = serializers.UUIDField()