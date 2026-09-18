"""
Duty on comparing name production_files and area_files
Check if it got prerequisite of merging file together.

"""
from typing import Literal

from django.core.files.uploadedfile import UploadedFile

from ..serializers.pairing_serializer import PairingUploadSerializer
from ..handlers.workbook_reader import WorkbookReader
from ..handlers.category_recognizer import CategoryRecognizer
from ..handlers.pair_validator import PairValidator


# create specific type to resctrict the type of argument
PROPERTY_TYPE = Literal["production", "area"]


class PairingService:

    def __init__(self):
        self._workbook_reader = WorkbookReader()
        self._category_recognizer = CategoryRecognizer()
        self._pair_validator = PairValidator()


    def build_preview(self, production_files: list[UploadedFile], area_files: list[UploadedFile]) -> dict:

        # get information(file_name, property type, major_category) of individual file
        production_items = self.__inspect_files(files= production_files, property_type= "production")
        area_items = self.__inspect_files(files= area_files, property_type= "area")

        return self._pair_validator.build_preview()


    def __inspect_files(self, files: list[UploadedFile], property_type: PROPERTY_TYPE) -> list[dict]:
        inspected_files = []


        for uploaded_file in files:
            title = self._workbook_reader.read_title_text(uploaded_file= uploaded_file)


            # Find main category of product
            major_category = self._category_recognizer.recognize(file_name= uploaded_file.name, title_text= title)

            # get list of inspected files
            inspected_files.append(
                {
                    "file_name": uploaded_file.name,
                    "property_type": property_type,
                    "major_category": major_category,
                }
            )

        return inspected_files