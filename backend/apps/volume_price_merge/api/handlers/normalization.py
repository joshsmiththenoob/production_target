from decimal import Decimal, ROUND_HALF_UP
import re
import unicodedata
import pandas as pd

COMMON_COLUMNS = [
    "大項", "作物", "年度", "指標", "單位", "數值"
]

# 統一採用目前 Excel 合併結果的分類名稱
MAJOR_CATEGORY_MAPPING = {
    "果樹": "果品",
    "特用作物": "特作",
}

# 針對特定作物進行分類
CROP_NAME_MAPPING = {
    "稻米(糙米)": "糙米",
    "稻米": "糙米",
}


def normalize_crop_name(value: str | None) -> str:
    name = clean_label(value).lstrip("*")
    return CROP_NAME_MAPPING.get(name, name)

def normalize_category(name: str) -> str:
    name = clean_label(name)
    return MAJOR_CATEGORY_MAPPING.get(name, name)



def normalize_value(value, *, round_integer=False):
    if value is None or pd.isna(value):
        return None

    text = re.sub(r"\s+", "", str(value))

    # 暫時保留缺值標記，不轉成 0
    if text in {"", "…", "...", "....", "-"}:
        return text

    number = Decimal(text.replace(",", ""))

    if round_integer:
        return int(number.quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        ))

    return number


def clean_label(text: str | None) -> str:
    """
    Erase the newline syntaax.
    """
    text = unicodedata.normalize("NFKC", text or "")
    return re.sub(r"\s+", "", text)
