"""
Duty on Pairing prduction/area informations from client
that the system could return the result to mention which category lack information.
"""
from uuid import UUID

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.jobs.models import Job
from config.utils.response_formatter import ResponseFormatter
from config.utils.response_serializers import ErrorResponseSerializer

# Most customization cases should be covered by the extend_schema decorator.
from drf_spectacular.utils import OpenApiRequest, extend_schema
from ..serializers.comparing_serializer import (
    ComparisonDataSerializer,
    ComparisonResponseSerializer,
    CompareRunRequestSerializer,
)
from ..services.comparing_service import (
    ComparisonInputError,
    ComparisonJobExpired,
    ComparisonJobNotRunnable,
    ComparingService,
)
from config.utils.response_formatter import ResponseFormatter
from config.utils.response_serializers import ErrorResponseSerializer

# Create your views here.

class ComparingView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []
    serializer_class = CompareRunRequestSerializer
    # serializer_class = PairingUploadSerializer


    @extend_schema(
        summary="執行 PDF 與合併 Excel 比對",
        request=CompareRunRequestSerializer,
        responses={
            200: ComparisonResponseSerializer,
            400: ErrorResponseSerializer,
            404: ErrorResponseSerializer,
            409: ErrorResponseSerializer,
            410: ErrorResponseSerializer,
            500: ErrorResponseSerializer,
        },
        tags=["Table Compare"],
    )
    def post(self, request, public_id: UUID):
        serializer = self.serializer_class(data=request.data)

        if not serializer.is_valid():
            return ResponseFormatter.error_response(
                code="invalid_scope",
                http_status=400,
                message="請檢查比對條件。",
                field_errors=serializer.errors,
            )

        try:
            result = ComparingService().run(
                public_id=public_id,
                **serializer.validated_data,
            )
            output = ComparisonDataSerializer(instance=result)

            return ResponseFormatter.success_response(
                data=output.data,
                http_status=200,
                message="比對完成。",
            )

        except Job.DoesNotExist:
            return ResponseFormatter.error_response(
                code="job_not_found",
                http_status=404,
                message="找不到指定的比對工作。",
            )

        except ComparisonJobExpired:
            return ResponseFormatter.error_response(
                code="job_expired",
                http_status=410,
                message="工作已過期，請重新上傳檔案。",
            )

        except ComparisonJobNotRunnable:
            return ResponseFormatter.error_response(
                code="job_not_runnable",
                http_status=409,
                message="目前的工作狀態無法執行比對。",
            )

        except ComparisonInputError as error:
            return ResponseFormatter.error_response(
                code="invalid_comparison",
                http_status=400,
                message=str(error),
            )

        except Exception as e:
            print(e)
            # logger.exception("Comparison failed: %s", public_id)

            return ResponseFormatter.error_response(
                code="comparison_failed",
                http_status=500,
                message="比對處理失敗，請稍後再試。",
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
