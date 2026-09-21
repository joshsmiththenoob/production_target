"""
Job on exctracting category of every product
"""
import re
from django.core.files.uploadedfile import UploadedFile



MAJOR_CATEGORY_ALIAS: dict[str, str] = {}

class CategoryRecognizer:

    def __init__(self):
        pass

    def recognize(self, file_name: str, title_text: str) -> str:
        """
        To recognize if file name and processed title of sheet are the same
        """
        file_category = self.__normalize(file_name)
        title_category = self.__normalize(title_text)

        # compare if file_name and title_name are the same
        if (file_category != title_category):
            raise ValueError(f"檔名大項「{file_category}」與標題大項「{title_category}」不一致。")


        return file_category


    def __normalize(self, value: str) -> str:
        name = re.sub(r"\.(xlsx|xls)$", "", value, flags=re.IGNORECASE)
        patterns = [
            r"110\s*[-－至到~～]?\s*113\s*年?",
            r"產量及產值",
            r"種植及收穫面積",
            r"按縣市別",
            r"按縣市",
            r"生產量值",
            r"合併果品",
            r"果品生產",
        ]
        for pattern in patterns:
            name = re.sub(pattern, "", name, flags=re.IGNORECASE)
        name = re.sub(r"[\s_\-－—()（）\[\]【】]+", "", name)
        name = name.strip(".、:：")
        return MAJOR_CATEGORY_ALIAS.get(name, name) or "未辨識大項"