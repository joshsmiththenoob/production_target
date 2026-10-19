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
from drf_spectacular.utils import OpenApiRequest, extend_schema
from ..services.comparing_service import ComparisonInputError,ComparingService
from ..serializers.comparing_serializer import ComparisonDataSerializer, ComparisonUploadSerializer, ComparisonResponseSerializer
from config.utils.response_formatter import ResponseFormatter
from config.utils.response_serializers import ErrorResponseSerializer

# Create your views here.

class ComparingView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []
    parser_classes = (MultiPartParser, FormParser)
    serializer_class = ComparisonUploadSerializer
    # serializer_class = PairingUploadSerializer


    @extend_schema(
        summary="比較 PDF 與合併 Excel",
        # request=ComparisonUploadSerializer,
        request=OpenApiRequest(
        request=ComparisonUploadSerializer,
        encoding={
            "crops": {"style": "form", "explode": True},
            "years": {"style": "form", "explode": True},
            "metrics": {"style": "form", "explode": True},
            },
        ),          
        responses={
            200: ComparisonResponseSerializer,
            400: ErrorResponseSerializer,
            500: ErrorResponseSerializer,
        },
        tags=["Table Compare"],
    )
    def post(self, request: Request) -> Response:
        print(request.data)
        serializer = self.serializer_class(data=request.data)

        if not serializer.is_valid():
            print(serializer.errors)
            return ResponseFormatter.error_response(
                code="invalid_upload",
                http_status=status.HTTP_400_BAD_REQUEST,
                message="請檢查檔案與比對條件。",
                field_errors=serializer.errors,
            )
        print(serializer.validated_data)
        try:
            result = ComparingService().compare(**serializer.validated_data)
        except ComparisonInputError as error:
            print(str(error))
            return ResponseFormatter.error_response(
                code="invalid_comparison",
                http_status=status.HTTP_400_BAD_REQUEST,
                message=str(error),
            )

        output = ComparisonDataSerializer(instance=result)

        return ResponseFormatter.success_response(
            data=output.data,
            http_status=status.HTTP_200_OK,
            message="比對完成。",
        )

    # def post(self, request: Request) -> Response:
    #     serializer = self.serializer_class(data= request.data)
    #     pass
        # if not serializer.is_valid():
            
        #     return ResponseFormatter.error_response(
        #             code= "invalid_upload",
        #             http_status= status.HTTP_400_BAD_REQUEST,
        #             message= "invalided uploaded file, Please check the both production and area file。",
        #             field_errors=serializer.errors,
        #         )

        # try:
        #     compare_service = PairingService()
        #     result = compare_service.build_preview(serializer.validated_data["production_files"],
        #                                         serializer.validated_data["area_files"])

        #     if (result["pairing_result"]["is_valid"]):
        #         # if pairing result we build is valid : need to create the related business job to summary the current work
        #         merge_job_service = MergeJobCreationService()
        #         job = merge_job_service.create(result["pairing_result"], file_infos= result["uploaded_file_infos"])

        #         # Wrap result with job's public_id
        #         response_data = {
        #                 "public_id": str(job.public_id),
        #                 "pairing_result": result["pairing_result"],
        #             }

        #         return ResponseFormatter.success_response(
        #             data= response_data,
        #             http_status= status.HTTP_201_CREATED,
        #             message=  "Pairing Sucessfully! Job created.",
        #         )


        #     else:
        #         return ResponseFormatter.error_response(
        #             code= "invalid_pairing",
        #             http_status= status.HTTP_400_BAD_REQUEST,
        #             message= "Something goes wrong! Please check the uploaded file and get both area/production information in every category!",
        #             field_errors= result["pairing_result"]
        #         )

                
        # except ValueError:
        #     return ResponseFormatter.error_response(
        #             code= "invalid_workbook",
        #             http_status= status.HTTP_400_BAD_REQUEST,
        #             message= "上傳的 Excel 檔案無法通過檢查。",
        #             field_errors= {}
        #         )
        
    
        # except Exception:

        #     return ResponseFormatter.error_response(
        #             code= "internal_error",
        #             http_status= status.HTTP_500_INTERNAL_SERVER_ERROR,
        #             message= "Internal Server Error!",
        #             field_errors= {}
        #         )
