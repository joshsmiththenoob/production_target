"""
Duty on Pairing prduction/area informations from client
that the system could return the result to mention which category lack information.
"""

from django.shortcuts import render
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from ..services.pairing_service import PairingService
from ..serializers.pairing_serializer import PairingUploadSerializer
from config.utils.response_formatter import ResponseFormatter


# Create your views here.

class PairingView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []
    parser_classes = (MultiPartParser, FormParser)
    serializer_class = PairingUploadSerializer

    def post(self, request: Request) -> Response:
        serializer = self.serializer_class(data= request.data)

        if not serializer.is_valid():
            response = ResponseFormatter.error_response(
                        code="invalid_upload",
                        message="invalided uploaded file, Please check the both production and area file。",
                        field_errors=serializer.errors,
                    )
            return Response(
                        data=response,
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        try:
            compare_service = PairingService()
            result = compare_service.build_preview(serializer.validated_data["production_files"],
                                                serializer.validated_data["area_files"])

            if (result["is_valid"]):
                response = ResponseFormatter.success_response(
                    data = result,
                    message = "Pairing Sucessfully!"
                )
                return Response(data = response,
                                status = status.HTTP_200_OK)

            else:
                response = ResponseFormatter.error_response(
                    code = "invalid_pairing",
                    message= "Something goes wrong! Please check the uploaded file and get both area/production information in every category!",
                    field_errors= result
                )
                return Response(data= response,
                                status = status.HTTP_400_BAD_REQUEST)
        except ValueError:
            response = ResponseFormatter.error_response(
                code="invalid_workbook",
                message="上傳的 Excel 檔案無法通過檢查。",
                field_errors={},
            )

            return Response(
                data=response,
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            response = ResponseFormatter.error_response(
                code= "internal_error",
                message="Internal Server Error!",
                field_errors={},
            )

            return  Response(
                data=response,
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
