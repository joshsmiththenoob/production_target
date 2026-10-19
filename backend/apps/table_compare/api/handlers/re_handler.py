"""
In charge of processing any string though regular expressions.
"""
import re
from typing import Any

from datetime import date, datetime, timedelta


class REHandler():
    def __init__(self):
        pass

    def is_year(self, value: Any) -> bool:
        return bool(re.fullmatch(r"1\d{2}\s*年", str(value).strip()))


    def is_blank(self, value: Any) -> bool:
        return value is None or str(value).strip() == ""

    def year_number(self, value: str) -> int:
        match = re.search(r"1\d{2}", value)
        return int(match.group()) if match else 9999

        
    def text(self, value: Any) -> str:
        return "" if self.is_blank(value) else str(value).strip()


    def safe_filename(self, value: str) -> str:
        cleaned = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "", self.text(value))
        cleaned = re.sub(r"\s+", "", cleaned)[:80]
        return cleaned


    def format_roc_date(self, value: date) ->str:
        roc_year = value.year - 1911
        return f"{roc_year:03d}.{value.month:02d}.{value.day:02d}"