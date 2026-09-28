"""
Duty on every jobs in Excel, which has composition of workbook reader 
and some other excel application objects.
"""
from .re_handler import REHandler



class ExcelHandler:
    def __init__(self):
        self.__RE_handler = REHandler()

    def detect_header_matrix_structure(self, rows) -> dict:
        scan_limit = min(len(rows), 8)
        # Find index of year header
        year_row_index = [
            index for index, row in enumerate(rows[:scan_limit])
            if any(self.__RE_handler.is_year(cell) for cell in row)
        ]
        print(year_row_index)


        if not year_row_index:
         raise ValueError("Can't find any year information in excel file. Please check header structure of file.")

        

        # Find index of crop/product's header 
        start = max(year_row_index) + 1
        candidates: list[tuple[int, int]] = []

        
        for row_index in range(start, scan_limit):
            row = rows[row_index]
            score = 0
            for value in row[1:]:
                if value and not self.__RE_handler.is_year(value) and value not in {"合計", "總計", "品項", "作物"}:
                    score += 1
            if score:
                candidates.append((score, row_index))
        if not candidates:
            raise ValueError("找不到作物列，請確認年度列下方是否有品項名稱。")
        crop_row_index = max(candidates, key=lambda item: (item[0], -item[1]))[1]

        # Find index of starting of dataset
        data_start_index = None
        for row_index in range(crop_row_index + 1, len(rows)):
            row = rows[row_index]
            if row and not self.__RE_handler.is_blank(row[0]) and any(not self.__RE_handler.is_blank(cell) for cell in row[1:]):
                data_start_index = row_index
                break
        if data_start_index is None:
            raise ValueError("找不到統計指標資料列。")

        return {
            "year_rows": year_row_index,
            "crop_row_index": crop_row_index,
            "data_start_index": data_start_index,
        }