from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook


XLSX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)


def make_xlsx_upload(
    filename: str,
    title: object,
    *,
    second_sheet_title: object | None = None,
) -> SimpleUploadedFile:
    workbook = Workbook()
    first_sheet = workbook.active
    first_sheet["A1"] = title

    if second_sheet_title is not None:
        second_sheet = workbook.create_sheet("second")
        second_sheet["A1"] = second_sheet_title

    content = BytesIO()
    workbook.save(content)
    workbook.close()

    return SimpleUploadedFile(
        filename,
        content.getvalue(),
        content_type=XLSX_CONTENT_TYPE,
    )


def make_invalid_xlsx_upload(filename: str) -> SimpleUploadedFile:
    return SimpleUploadedFile(
        filename,
        b"this is not an xlsx archive",
        content_type=XLSX_CONTENT_TYPE,
    )
