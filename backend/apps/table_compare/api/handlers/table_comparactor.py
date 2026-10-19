"""
Duty on compare Merged Excel to PDF for production/area information of every crop.
"""
import pandas as pd
from pathlib import Path

from .adapters.excel_table_adapter import ExcelTableAdapter
from .adapters.pdf_table_adapter import PDFTableAdapter

class TableComparactor:
    KEYS = ["作物", "年度", "指標"]

    def __init__(self):
        pass


    def _select_records(self, df, crops, years, metrics):
        """
        Get three conditions of filter from client.
        """
        return df.loc[
            df["作物"].isin(crops)
            & df["年度"].isin(years)
            & df["指標"].isin(metrics)
        ].copy()


    @staticmethod
    def _compare_status(row):
        if row["_merge"] == "left_only":
            return "Excel 缺少資料"

        if row["_merge"] == "right_only":
            return "PDF 缺少資料"

        if row["單位_pdf"] != row["單位_excel"]:
            return "單位不同"

        values = [row["數值_pdf"], row["數值_excel"]]

        if any(
            pd.isna(value) or isinstance(value, str)
            for value in values
        ):
            return "缺值／標記，暫不比對"

        return "相同" if values[0] == values[1] else "數值不同"




    def start_comparing(self, excel_df, pdf_df, *, crops, years, metrics):

        excel = self._select_records(excel_df, crops, years, metrics)
        pdf = self._select_records(pdf_df, crops, years, metrics)

        result = pdf.merge(
            excel,
            on=self.KEYS,
            how="outer",
            suffixes=("_pdf", "_excel"),
            indicator=True,
            validate="one_to_one",
        )

        result["比對結果"] = result.apply(self._compare_status, axis=1)
        return result.drop(columns="_merge")

