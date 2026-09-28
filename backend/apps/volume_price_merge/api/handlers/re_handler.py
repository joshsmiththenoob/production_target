"""
In charge of processing any string though regular expressions.
"""
import re
from typing import Any

from datetime import datetime, timedelta


class REHandler():
    def __init__(self):
        pass

    def is_year(self, value: Any) -> bool:
        return bool(re.fullmatch(r"1\d{2}\s*年", str(value).strip()))


    def is_blank(self, value: Any) -> bool:
        return value is None or str(value).strip() == ""