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


class ComparisonRowSerializer(serializers.Serializer):
    crop = serializers.CharField(source="作物")
    year = serializers.IntegerField(source="年度")
    metric = serializers.CharField(source="指標")

    pdf_unit = serializers.CharField(source="單位_pdf", allow_null=True, allow_blank=True)
    excel_unit = serializers.CharField(source="單位_excel", allow_null=True, allow_blank=True)

    pdf_value = serializers.CharField(source="數值_pdf", allow_null=True, allow_blank=True)
    excel_value = serializers.CharField(source="數值_excel", allow_null=True, allow_blank=True)
    
    status = serializers.CharField(source="比對結果")


class ComparisonDataSerializer(serializers.Serializer):
    row_count = serializers.IntegerField()
    rows = ComparisonRowSerializer(many=True)


class ComparisonResponseSerializer(serializers.Serializer):
    data = ComparisonDataSerializer()
    message = serializers.CharField()



# class ComparingUploadSerializer(serializers.Serializer):
#     _xlsx_validator = FileValidator()
#     _pdf_validator = FileValidator(extension_name= ".pdf")

#     excel_files = serializers.ListField(
#         child = serializers.FileField(validators = [_xlsx_validator]),
#         allow_empty = False,
#     )

#     pdf_files = serializers.ListField(
#         child = serializers.FileField(validators = [_pdf_validator]),
#         allow_empty = False,
#     )

# class PairSerializer(serializers.Serializer):
#     """
#     result of every pair from all input files (production + area)
#     """
#     major_category = serializers.CharField()
#     production_files = serializers.ListField(child=serializers.CharField())
#     area_files = serializers.ListField(child=serializers.CharField())
#     complete = serializers.BooleanField()


# class PairingResultSerializer(serializers.Serializer):
#     """
#     Coollection of all pair's result
#     """
#     is_valid = serializers.BooleanField()
#     pairs = PairSerializer(many=True)
#     errors = serializers.ListField(child=serializers.CharField())


# class CreatedJobDataSerializer(serializers.Serializer):
#     """
#     Record after created job
#     """
#     public_id = serializers.UUIDField()
#     pairing_result = PairingResultSerializer()


# class CreatedJobResponseSerializer(serializers.Serializer):
#     """
#     Response of bussiness job created successfully
#     """
#     data = CreatedJobDataSerializer()
#     message = serializers.CharField()
