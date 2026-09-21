"""
Duty on comparing name production_files and area_files
Check if it got prerequisite of merging file together.

"""
from typing import Literal

from django.core.files.uploadedfile import UploadedFile

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
        """
        Get the result of pairing if every category get both production/area informations.
        """
        # get information(file_name, property type, major_category) of production/area file
        production_infos = self.__inspect_files(files= production_files, property_type= "production")
        area_infos = self.__inspect_files(files= area_files, property_type= "area")

        return self._pair_validator.build_preview(production_infos, area_infos)


    def __inspect_files(self, files: list[UploadedFile], property_type: PROPERTY_TYPE) -> list[dict]:
        """
        inspect all files to exctract their:
            1. file name
            2. major_category: recognized result of sheet title which is same as file name

        to represent the information of area and production file respectively.

        """
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