"""
Job on validating if product and area are the pair of the same product 
"""
from django.core.files.uploadedfile import UploadedFile


class PairValidator:
    def __init__(self):
        pass

    def build_preview(self, production_items: list[dict], area_items: list[dict]) -> dict:
        grouped = dict()

        for item in (production_items + area_items):
            category = item["major_category"]

            #
            pair = grouped.setdefault(category,
                                        {
                                            "major_category": category,
                                            "production": [],
                                            "area": [],
                                        }
                                      )


            pair[item["property_type"]].append(item["file_name"])


        pairs = list()
        errors = list()

        # Check the both count of production and area equal 1 -> get the pair
        for pair in grouped.values():
            production_count = len(pair["production"])
            area_count = len(pair["area"])


            if production_count == 0:
                errors.append(f"「{pair['major_category']}」缺少產量及產值檔案。")
            elif production_count > 1:
                errors.append( f"「{pair['major_category']}」有重複的產量及產值檔案。")

            if area_count == 0:
                errors.append(f"「{pair['major_category']}」缺少種植及收穫面積檔案。")
            elif area_count > 1:
                errors.append(f"「{pair['major_category']}」有重複的種植及收穫面積檔案。" )

            complete = ((production_count == 1) and (area_count == 1))



