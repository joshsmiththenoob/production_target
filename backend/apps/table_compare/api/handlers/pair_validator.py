"""
Job on validating if product and area are the pair of the same product 
"""
from django.core.files.uploadedfile import UploadedFile


class PairValidator:
    def __init__(self):
        pass

    def build_preview(self, production_infos: list[dict], area_infos: list[dict]) -> dict:
        """
        Create the grouped mapping to check
        if there's a pair of production/area in every specific category or not
        """

        # Get group of category which have production/area informations
        grouped_infos = {}

        for item in (production_infos + area_infos):
            category = item["major_category"]

            # Create new dictionary in the group, like
            """
            group = {
                    category: {
                        "matorcategory": category,
                        "production": [],
                        "area": [],
                    }

            }
            """
            pair = grouped_infos.setdefault(category,
                                        {
                                            "major_category": category,
                                            "production": [],
                                            "area": [],
                                        }
                                      )

            # According to property_type(production/area) as key, need to insert value with file name
            pair[item["property_type"]].append(item["file_name"])


        return self.__check_pairs_result(grouped_infos)




    def __check_pairs_result(self, grouped_infos: dict[str, dict] = None) -> dict:
        """
        Check if every grouped category's information got both area/production infos or NOT
        """

        pairs = list()
        errors = list()


        # Check the count of both category's production and area equal 1 -> get the pair
        for pair in grouped_infos.values():

            # for each category of group
            production_count = len(pair["production"])
            area_count = len(pair["area"])

            # Check count of production/area in every category
            if production_count == 0:
                errors.append(f"「{pair['major_category']}」缺少產量及產值檔案。")
            elif production_count > 1:
                errors.append( f"「{pair['major_category']}」有重複的產量及產值檔案。")

            if area_count == 0:
                errors.append(f"「{pair['major_category']}」缺少種植及收穫面積檔案。")
            elif area_count > 1:
                errors.append(f"「{pair['major_category']}」有重複的種植及收穫面積檔案。" )



            complete = ((production_count == 1) and (area_count == 1))
            pairs.append(
                            {
                                "major_category": pair["major_category"],
                                "production_files": pair["production"],
                                "area_files": pair["area"],
                                "complete": complete,
                            }
                        )

        return {
            "is_valid": not errors,
            "pairs": pairs,
            "errors": errors,
        }
