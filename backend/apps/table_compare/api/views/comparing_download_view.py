"""
Duty on Merging prduction/area informations after checking sucessful pairing result from client.
"""
from uuid import UUID


from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.negotiation import DefaultContentNegotiation
from django.http import FileResponse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache


from apps.jobs.models import Job
from apps.volume_price_merge.api.serializers.merging_download_serializer import (
    MergingDownloadRequestSerializer
)
from apps.volume_price_merge.api.services.merging_service import (
    MergeJobExpired,
    MergeJobNotInStatus,
    MergeInputInvalid,
    MergingService,
)
from config.utils.response_formatter import ResponseFormatter
from config.utils.response_serializers import ErrorResponseSerializer


class DownloadContentNegotiation(DefaultContentNegotiation):
    # The default response renderer was JSONRenderer -> Response with JSON
    # But this time, we need to response FILE. Therefore we need to override select_renderer to replace JSONRenderer
    def select_renderer(self, request, renderers, format_suffix=None):
        return renderers[0], renderers[0].media_type




# Create your views here.
@method_decorator(never_cache, name="dispatch")
class ComparingDownloadView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []
    # Specify the content_negotiation_class of APIView to provide file for downloading
    content_negotiation_class = DownloadContentNegotiation


    XLSX_TYPE = (
        "application/vnd.openxmlformats-officedocument."
        "spreadsheetml.sheet"
    )
    
    @extend_schema(
        summary="下載生產量值整併",
        # # request payload
        # request= None,
        # parameters= [MergingDownloadRequestSerializer],
        responses={
            (200, XLSX_TYPE): OpenApiTypes.BINARY,
            400: ErrorResponseSerializer,
            404: ErrorResponseSerializer,
            409: ErrorResponseSerializer,
            410: ErrorResponseSerializer,
            500: ErrorResponseSerializer,
        },
        tags=["Table Compare"],
    )
    def get(self, request: Request, public_id: UUID) -> Response:
        input_serializer = MergingDownloadRequestSerializer(data=request.query_params)
        if not input_serializer.is_valid():
            return ResponseFormatter.error_response(
                code="invalid_product",
                http_status=status.HTTP_400_BAD_REQUEST,
                message="下載條件無效，請重新選擇作物。",
                field_errors=input_serializer.errors,
            )

        try:
            merging_service = MergingService()
            result = merging_service.get_workbook(public_id, input_serializer.validated_data["product"])
            
            return FileResponse(result["file_buffer"], as_attachment= True, filename=result["file_name"], content_type = self.XLSX_TYPE)

        except Job.DoesNotExist:
            return ResponseFormatter.error_response(
                    code= "job_not_found",
                    http_status= status.HTTP_404_NOT_FOUND,
                    message= "找不到指定的工作。",
                )

        except MergeJobExpired:
            return ResponseFormatter.error_response(
                    code= "job_expired",
                    http_status= status.HTTP_410_GONE,
                    message= "工作已過期，請重新上傳檔案。",
                )

        except MergeJobNotInStatus:
            return ResponseFormatter.error_response(
                    code= "job_not_runnable",
                    http_status= status.HTTP_409_CONFLICT,
                    message= "目前的工作狀態無法執行合併。",
                )

        except MergeInputInvalid:
            return ResponseFormatter.error_response(
                    code="invalid_product",
                    http_status=status.HTTP_400_BAD_REQUEST,
                    message="找不到指定作物，請重新選擇。",
                )

        except Exception:
            return ResponseFormatter.error_response(
                    code= "internal_server_error",
                    http_status= status.HTTP_500_INTERNAL_SERVER_ERROR,
                    message= "下載處理失敗，請稍後再試。",
                )

