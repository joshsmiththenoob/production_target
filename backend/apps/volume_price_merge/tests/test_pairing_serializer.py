from django.test import SimpleTestCase

from apps.volume_price_merge.api.serializers.pairing_serializer import (
    PairingUploadSerializer,
)

from .helpers import make_xlsx_upload


class PairingUploadSerializerTests(SimpleTestCase):
    @staticmethod
    def _valid_file(filename: str = "果品產量及產值.xlsx"):
        return make_xlsx_upload(filename, "果品產量及產值")

    def test_production_files_is_required(self) -> None:
        serializer = PairingUploadSerializer(
            data={"area_files": [self._valid_file("果品種植及收穫面積.xlsx")]}
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("production_files", serializer.errors)

    def test_area_files_is_required(self) -> None:
        serializer = PairingUploadSerializer(
            data={"production_files": [self._valid_file()]}
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("area_files", serializer.errors)

    def test_file_lists_cannot_be_empty(self) -> None:
        cases = (
            {
                "production_files": [],
                "area_files": [self._valid_file("果品種植及收穫面積.xlsx")],
                "expected_field": "production_files",
            },
            {
                "production_files": [self._valid_file()],
                "area_files": [],
                "expected_field": "area_files",
            },
        )

        for case in cases:
            with self.subTest(field=case["expected_field"]):
                serializer = PairingUploadSerializer(
                    data={
                        "production_files": case["production_files"],
                        "area_files": case["area_files"],
                    }
                )

                self.assertFalse(serializer.is_valid())
                self.assertIn(case["expected_field"], serializer.errors)

    def test_lowercase_xlsx_files_are_valid(self) -> None:
        serializer = PairingUploadSerializer(
            data={
                "production_files": [self._valid_file()],
                "area_files": [self._valid_file("果品種植及收穫面積.xlsx")],
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_uppercase_xlsx_files_are_valid(self) -> None:
        serializer = PairingUploadSerializer(
            data={
                "production_files": [self._valid_file("果品產量及產值.XLSX")],
                "area_files": [self._valid_file("果品種植及收穫面積.XLSX")],
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_unsupported_extensions_are_rejected(self) -> None:
        for extension in (".xls", ".csv", ".txt"):
            with self.subTest(extension=extension):
                serializer = PairingUploadSerializer(
                    data={
                        "production_files": [
                            self._valid_file(f"果品產量及產值{extension}")
                        ],
                        "area_files": [
                            self._valid_file("果品種植及收穫面積.xlsx")
                        ],
                    }
                )

                self.assertFalse(serializer.is_valid())
                self.assertIn("production_files", serializer.errors)
