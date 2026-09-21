"""
In charge of reading and checking excel workbook if it's in specification or not.
"""
from django.core.files.uploadedfile import UploadedFile
from openpyxl import load_workbook


class WorkbookReader:

    def __init__(self):
        pass

    def read_title_text(self, uploaded_file: UploadedFile) -> str:
        # seek(0)
        uploaded_file.seek(0)
        workbook = None

        try:
            workbook = load_workbook(filename= uploaded_file, read_only= True, data_only= True)

            # CHeck if there's any worksheets or NOT
            if (not workbook.worksheets):
                raise ValueError (f"檔案「{uploaded_file.name}」沒有工作表。")

            # Get the first worksheet's title
            title = workbook.worksheets[0]["A1"].value


            if not isinstance(title, str) or not title.strip():
                raise ValueError("Excel 的 A1 沒有有效標題。")

            return title.strip()


        except Exception as e:
            raise ValueError( f"無法讀取 Excel 檔案「{uploaded_file.name}」, 原因為 {e}")


        # need to close workbook if workbook got any worksheets or not
        finally:
            if (workbook is not None):
                workbook.close()

            uploaded_file.seek(0)