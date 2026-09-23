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
# Most customization cases should be covered by the extend_schema decorator.
from drf_spectacular.utils import extend_schema
from ..services.pairing_service import PairingService, MergeJobCreationService
from ..serializers.pairing_serializer import PairingUploadSerializer, CreatedJobResponseSerializer
from config.utils.response_formatter import ResponseFormatter
from config.utils.response_serializers import ErrorResponseSerializer

# Create your views here.

class PairingView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []
    parser_classes = (MultiPartParser, FormParser)
    serializer_class = PairingUploadSerializer


    @extend_schema(
        summary="建立量價合併工作",
        request=PairingUploadSerializer,
        responses={
            201: CreatedJobResponseSerializer,
            400: ErrorResponseSerializer,
        },
        tags=["Volume Price Merge"],
    )

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

            if (result["pairing_result"]["is_valid"]):
                # if pairing result we build is valid : need to create the related business job to summary the current work
                merge_job_service = MergeJobCreationService()
                job = merge_job_service.create(result["pairing_result"], 
                                        file_infos= result["uploaded_file_infos"])

                # Wrap result with job's public_id
                response = ResponseFormatter.success_response(
                    data = {
                        "public_id": str(job.public_id),
                        "pairing_result": result["pairing_result"],
                    },
                    message = "Pairing Sucessfully! And Job created."
                )
                return Response(data = response,
                                status = status.HTTP_201_CREATED)

            else:
                response = ResponseFormatter.error_response(
                    code = "invalid_pairing",
                    message= "Something goes wrong! Please check the uploaded file and get both area/production information in every category!",
                    field_errors= result["pairing_result"]
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
