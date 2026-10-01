"""
Duty on every jobs in Excel, which has composition of workbook reader 
and some other excel application objects.
"""
from typing import Any
from collections import OrderedDict

from .re_handler import REHandler



class ExcelHandler:
    def __init__(self):
        self.__RE_handler = REHandler()

    def _detect_header_matrix_structure(self, rows) -> dict:
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

    
    def normalize_input(self, rows: list[list[Any]], major_category: str, source_type: str, file_name: str) -> dict[str, Any]:
        header = self._detect_header_matrix_structure(rows)
        max_columns = max((len(row) for row in rows), default=0)
        columns: list[dict[str, Any]] = []

        # Get current_year
        current_year = ""
        for col_index in range(1, max_columns):
            for year_row_index in header["year_rows"]:
                value = rows[year_row_index][col_index] if col_index < len(rows[year_row_index]) else None
                if self.__RE_handler.is_year(value):
                    current_year = value


            crop = rows[header["crop_row_index"]][col_index] if col_index < len(rows[header["crop_row_index"]]) else ""
            if current_year and crop:
                columns.append({
                    "majorCategory": major_category,
                    "year": current_year,
                    "crop": crop,
                    "sourceCol": col_index,
                    "key": self.column_key(major_category, current_year, crop),
                })
        if not columns:
            raise ValueError(f"「{file_name}」表頭無法對齊，找不到年度與作物欄位。")

        output_rows: list[dict[str, Any]] = []
        for row in rows[header["data_start_index"]:]:
            metric = row[0] if row else ""
            if not metric:
                continue
            values: OrderedDict[str, list[Any]] = OrderedDict()
            for column in columns:
                value = row[column["sourceCol"]] if column["sourceCol"] < len(row) else None
                values.setdefault(column["key"], []).append(value)
            output_rows.append({"metric": metric, "valuesByKey": dict(values)})
        if not output_rows:
            raise ValueError(f"「{file_name}」找不到有效的統計指標資料列。")
        return {
            "majorCategory": major_category,
            "sourceType": source_type,
            "fileName": file_name,
            "columns": columns,
            "rows": output_rows,
        }


    def column_key(self, major_category: str, year: str, crop: str) -> str:
        return f"{major_category}||{year}||{crop}"


    def build_column_order(self, all_sources: list[dict[str, Any]]) -> list[dict[str, str]]:
        seen: set[str] = set()
        major_order: OrderedDict[str, int] = OrderedDict()
        crop_order: dict[tuple[str, str], int] = {}
        result = []
        for source in all_sources:
            major = source["majorCategory"]
            major_order.setdefault(major, len(major_order))
            for column in source["columns"]:
                crop_order.setdefault((major, column["crop"]), len(crop_order))
                if column["key"] not in seen:
                    seen.add(column["key"])
                    result.append({key: column[key] for key in ("key", "majorCategory", "year", "crop")})
        
        
        return sorted(result, key=lambda item: (
            major_order[item["majorCategory"]],
            self.__RE_handler.year_number(item["year"]),
            crop_order[(item["majorCategory"], item["crop"])],
        ))


    def build_merged_rows(self, all_sources: list[dict[str, Any]], column_order: list[dict[str, str]]) -> list[dict[str, Any]]:
        merged_rows = []
        for source in all_sources:
            for source_row in source["rows"]:
                merged_rows.append({
                    "metric": source_row["metric"],
                    "sourceType": source["sourceType"],
                    "majorCategory": source["majorCategory"],
                    "values": [self._collapse_duplicate_values(source_row["valuesByKey"].get(column["key"], [])) for column in column_order],
                })
        return merged_rows


    def _collapse_duplicate_values(self, values: list[Any]) -> Any:
        if not values:
            return None
        if len(values) == 1:
            return values[0]
        return " / ".join( "" if self.__RE_handler.is_blank(value) else str(value) for value in values)


    def build_result_data(self, column_order: list[dict[str, Any]], merged_rows: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Build results from camelCase to snake_case
        """
        
        columns = [{
            "key": column["key"],
            "major_category": column["majorCategory"],
            "year": column["year"],
            "crop": column["crop"]
        } for column in column_order]


        rows = [
            {
            "metric": row["metric"],
            "property_type": row["sourceType"],
            "major_category": row["majorCategory"],
            "values": row["values"],
        }for row in merged_rows
        ]

        # Extract deduplicated product(crop) name from columns
        # Note: dict.formkeys() help us to deduplicate crop and contain the origin order.
        available_crops = [dict.fromkeys(column["crop"] for column in columns) ]

        return {
            "schema_version": 1,
            "columns": columns,
            "rows": rows,
            "available_crops": available_crops,
            "summary": {
                "column_count": len(columns),
                "row_count": len(rows),
            }
        }
