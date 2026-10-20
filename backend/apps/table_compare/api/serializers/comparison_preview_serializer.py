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



METRICS = ["產量", "產值", "種植面積", "收穫面積"]


class ComparisonUploadSerializer(serializers.Serializer):
    # class Metric(models.TextChoices):
    #     """
    #     Statistics Metric
    #     """
    #     PENDING = ("production_volume", "產量")
    #     RUNNING = ("production_price", "產值")
    #     SUCCEEDED = ("planted_area", "種植面積")
    #     FAILED = ("harvested_area", "收穫面積")
    excel_file = serializers.FileField(validators=[FileValidator(".xlsx")])
    pdf_file = serializers.FileField(validators=[FileValidator(".pdf")])

    crops = serializers.ListField(child=serializers.CharField(),allow_empty=False,)
    years = serializers.ListField(child=serializers.IntegerField(min_value=1),allow_empty=False,)
    metrics = serializers.ListField(
        child=serializers.ChoiceField(choices=METRICS),
        allow_empty=False,
        default=METRICS,
    )


class ComparisonPreviewUploadSerializer(serializers.Serializer):
    excel_file = serializers.FileField(validators=[FileValidator(".xlsx")])
    pdf_file = serializers.FileField(validators=[FileValidator(".pdf")])


class ComparisonPreviewDefaultsSerializer(serializers.Serializer):
    crops = serializers.ListField(
        child=serializers.CharField(),
        allow_empty=True,
    )
    years = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=True,
    )
    metrics = serializers.ListField(
        child=serializers.ChoiceField(choices=METRICS),
        allow_empty=True,
    )


class ComparisonPreviewDataSerializer(serializers.Serializer):
    crops = serializers.ListField(
        child=serializers.CharField(),
        allow_empty=True,
    )
    years = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=True,
    )
    metrics = serializers.ListField(
        child=serializers.ChoiceField(choices=METRICS),
        allow_empty=True,
    )
    defaults = ComparisonPreviewDefaultsSerializer()
    issues = serializers.ListField(
        child=serializers.CharField(),
        allow_empty=True,
    )


class ComparisonPreviewResponseSerializer(serializers.Serializer):
    data = ComparisonPreviewDataSerializer()
    message = serializers.CharField()
