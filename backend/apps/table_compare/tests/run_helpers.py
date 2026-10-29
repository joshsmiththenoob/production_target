from datetime import timedelta
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from openpyxl import Workbook

from apps.jobs.models import Job
from apps.table_compare.models import CompareInputFile, TableCompareJob


DEFAULT_PREVIEW = {
    "crops": ["香蕉"],
    "years": [112],
    "metrics": ["產量"],
    "defaults": {
        "crops": ["香蕉"],
        "years": [112],
        "metrics": ["產量"],
    },
    "issues": ["匿名預覽提醒"],
}


def make_run_xlsx_bytes(*, value: int = 10) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    for row in [
        ["匿名完整合併結果"],
        ["", "112年"],
        ["", "果品"],
        ["", "香蕉"],
        ["果品產量(公噸)", value],
    ]:
        sheet.append(row)

    output = BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


def _pdf_text(text: str, x: int, y: int, size: int = 7) -> bytes:
    encoded = text.encode("utf-16-be").hex().upper()
    return f"BT /F1 {size} Tf {x} {y} Td <{encoded}> Tj ET\n".encode()


def make_run_pdf_bytes(*, value: int = 10) -> bytes:
    x_start = 40
    y_top = 620
    column_width = 50
    row_height = 30
    headers = ["作物", "項目", "", "單位", "112實績", "", "", "", "", ""]
    values = ["香蕉", "總產量", "", "公噸", str(value), "", "", "", "", ""]

    content = bytearray()
    content.extend(_pdf_text("作物別:果樹—匿名資料", 40, 700, 12))
    content.extend(b"0.5 w\n")
    for row_index in range(3):
        y = y_top - row_index * row_height
        content.extend(
            f"{x_start} {y} m {x_start + column_width * 10} {y} l S\n".encode()
        )
    for column_index in range(11):
        x = x_start + column_index * column_width
        content.extend(
            f"{x} {y_top} m {x} {y_top - row_height * 2} l S\n".encode()
        )

    for row_index, row in enumerate((headers, values)):
        baseline = y_top - row_index * row_height - 20
        for column_index, text in enumerate(row):
            if text:
                content.extend(
                    _pdf_text(
                        text,
                        x_start + column_index * column_width + 3,
                        baseline,
                    )
                )

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
        ),
        (
            b"<< /Type /Font /Subtype /Type0 /BaseFont /MSung-Light "
            b"/Encoding /UniCNS-UTF16-H /DescendantFonts [6 0 R] >>"
        ),
        (
            b"<< /Length " + str(len(content)).encode() +
            b" >>\nstream\n" + bytes(content) + b"endstream"
        ),
        (
            b"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /MSung-Light "
            b"/CIDSystemInfo << /Registry (Adobe) /Ordering (CNS1) "
            b"/Supplement 7 >> /DW 1000 >>"
        ),
    ]

    document = b"%PDF-1.4\n"
    offsets = []
    for index, pdf_object in enumerate(objects, start=1):
        offsets.append(len(document))
        document += (
            f"{index} 0 obj\n".encode() + pdf_object + b"\nendobj\n"
        )

    xref_offset = len(document)
    document += b"xref\n0 7\n0000000000 65535 f \n"
    document += b"".join(
        f"{offset:010d} 00000 n \n".encode() for offset in offsets
    )
    document += (
        b"trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n" +
        str(xref_offset).encode() + b"\n%%EOF\n"
    )
    return document


def create_compare_job(
    *,
    status: str = Job.Status.PENDING,
    expired: bool = False,
    preview: dict | None = None,
    result_data: dict | None = None,
    with_files: bool = False,
    excel_content: bytes | None = None,
    pdf_content: bytes | None = None,
) -> tuple[Job, TableCompareJob]:
    job = Job.objects.create(
        kind=Job.Kind.TABLE_COMPARE,
        status=status,
        expires_at=timezone.now() + timedelta(hours=-1 if expired else 1),
    )
    compare_job = TableCompareJob.objects.create(
        job=job,
        preview=preview or DEFAULT_PREVIEW,
        result_data=result_data,
    )

    if with_files:
        sources = (
            (
                CompareInputFile.FileType.EXCEL,
                "anonymous.xlsx",
                excel_content or b"anonymous excel",
            ),
            (
                CompareInputFile.FileType.PDF,
                "anonymous.pdf",
                pdf_content or b"anonymous pdf",
            ),
        )
        for file_type, filename, content in sources:
            uploaded_file = SimpleUploadedFile(filename, content)
            CompareInputFile.objects.create(
                compare_job=compare_job,
                file_type=file_type,
                original_name=filename,
                file=uploaded_file,
                size_bytes=len(content),
            )

    return job, compare_job
