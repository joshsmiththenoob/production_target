"""
Common Serializers for every App
"""

from rest_framework import serializers


class ErrorResponseSerializer(serializers.Serializer):
    code = serializers.CharField()
    message = serializers.CharField()
    field_errors = serializers.DictField(allow_null=True)