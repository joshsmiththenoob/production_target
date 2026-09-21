from pathlib import Path
from rest_framework import serializers


# Custom class-based validator -> use the __call__() method

class FileValidator:
    def __init__(self, extension_name:str = ".xlsx"):
        self.extension_name = extension_name

    def __call__(self, uploaded_file):
        """
        Check if extension of file is .xlsx or not
        """

        # Get extension of file
        extension = Path(uploaded_file.name).suffix.lower()

        if (extension != self.extension_name):
            raise serializers.ValidationError(f"目前只支援 {self.extension_name} 檔案")





class PairingUploadSerializer(serializers.Serializer):
    _xlsx_validator = FileValidator()

    production_files = serializers.ListField(
        child = serializers.FileField(validators = [_xlsx_validator]),
        allow_empty = False,
    )

    area_files = serializers.ListField(
        child = serializers.FileField(validators = [_xlsx_validator]),
        allow_empty = False,
    )

