"""
The PDF Adapter is responsible for 
1. loading PDF files like .pdf
2. then converting them into a common DataFrame format for comparison.
"""
import re
import pdfplumber
import pandas as pd

from .base import DataAdapter
from ..utils.normalization import (
    COMMON_COLUMNS,
    clean_label,
    normalize_category,
    normalize_value,
    normalize_crop_name
)

class PDFTableAdapter(DataAdapter):
    def __init__(self, path: str, sheet_name= 0):
        self.path = path
        self.sheet_name = sheet_name

    def load(self) -> pd.DataFrame:
        """Load the Excel file and convert it to a Standardized DataFrame."""
        # d = pd.DataFrame()
        frames = []
        skipped_pages = []
        with pdfplumber.open(self.path) as pdf:
            for page_number, page in enumerate(pdf.pages, start=1):
                try:
                    table_data = page.extract_table()

                    # print(len(table_data))

                    if not table_data:
                        raise ValueError("找不到表格")

                    frames.append(self._normalize(table_data))

                # # 清理欄名；空欄名先給唯一名稱，保留原本的資料欄
                # columns = [clean_label(column) or f"unnamed_{index}" for index, column in enumerate(table_data[0])]

                # # 暫時只處理和第一張表相同的欄位結構
                # if expected_columns is not None and columns != expected_columns:
                #     raise ValueError("欄位結構不同，暫不處理")

                # df = pd.DataFrame(table_data[1:], columns=columns)
                # d = pd.concat([d, df], ignore_index=True)

                # # 第一張成功合併的表，作為後續參考
                # if expected_columns is None:
                #     expected_columns = columns

                except Exception as e:
                    skipped_pages.append({
                        "頁碼": page_number,
                        "原因": str(e),
                    })
                    print(f"跳過第 {page_number} 頁：{e}")
                    continue
            return (
                pd.concat(frames, ignore_index=True)
                if frames
                else pd.DataFrame(columns=COMMON_COLUMNS)
            )

            # return d


    def _normalize(self, table) -> pd.DataFrame:
        # Check if record in table got 10 columns
        if len(table[0]) != 10:
            raise ValueError("目前尚未支援這個表格版型")

        metric_map = {
            "總產量": "產量",
            "產值": "產值",
            "種植面積": "種植面積",
            "收穫面積": "收穫面積",
        }

        years = []

        # Extract year for each table's header: the frist row of table
        for column, label in enumerate(table[0]):
            match = re.fullmatch(
                r"(\d+)實績", clean_label(label)
            )
            if match:
                years.append((column, int(match.group(1))))

        records = []
        crop = ""

        # The rest content of the table will be clean and filter by statistics index
        for row in table[1:]:
            crop = normalize_crop_name(row[0]) or crop
            metric = metric_map.get(clean_label(row[1]))

            if not metric:
                continue

            for column, year in years:
                records.append([
                    crop,
                    year,
                    metric,
                    clean_label(row[3]), # unt 
                    normalize_value(row[column]), #value 
                ])

        return pd.DataFrame(records, columns=COMMON_COLUMNS)

        
        # raw_df = pd.read_excel(self.path, sheet_name=self.sheet_name)



        # return self.__convert_to_dataframe(raw_df)
    

    def _detect_major_category(self, text: str | None) -> str:
        match = re.search(
            r"作物別:(.+?)[—–-]",
            clean_label(text),
        )
        if not match:
            raise ValueError("找不到農產品分類")

        return normalize_category(match.group(1))