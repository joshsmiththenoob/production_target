"""
Duty on Merging prduction/area informations after checking sucessful pairing result from client.
"""
from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.jobs.models import Job
from apps.volume_price_merge.api.serializers.merging_result_serializer import (
    MergeResultRequestSerializer,
    MergeResultDataSerializer,
    MergeResultResponseSerializer,
)
from apps.volume_price_merge.api.serializers.merging_serializer import(
    MergingSummaryResponseSerializer,
)


from apps.volume_price_merge.api.services.merging_service import (
    MergeJobExpired,
    MergeJobNotInStatus,
    MergeInputInvalid,
    MergingService,
)
from config.utils.response_formatter import ResponseFormatter
from config.utils.response_serializers import ErrorResponseSerializer

# Create your views here.

class MergingResultView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []


    @extend_schema(
        summary="查詢已存在之合併結果",
        # request payload
        # request=MergeResultRequestSerializer,
        parameters=[MergeResultRequestSerializer],
        responses={
            200: MergeResultResponseSerializer,
            404: ErrorResponseSerializer,
            409: ErrorResponseSerializer,
            410: ErrorResponseSerializer,
            500: ErrorResponseSerializer,
        },
        tags=["Volume Price Merge"],
    )
    def get(self, request: Request, public_id: UUID) -> Response:
        """
        Get the existed merged result of specific job filtered by specific product from client.
        """
        
        try:
            # Parse query parameters with serializer
            input_serializer = MergeResultRequestSerializer(data= request.query_params)
            input_serializer.is_valid(raise_exception= True)
            merging_service = MergingService()
            query_result = merging_service.query_by_product(public_id, input_serializer.validated_data["product"])
            output_serializer = MergeResultDataSerializer(data=query_result)
            output_serializer.is_valid(raise_exception= True)
            print(output_serializer.is_valid())

            return ResponseFormatter.success_response(
                    data=output_serializer.data,
                    http_status= status.HTTP_200_OK,
                    message= "查詢完成。",

            )

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
                    code= "job_not_successful",
                    http_status= status.HTTP_409_CONFLICT,
                    message= "目前的工作狀態非合併完成，無法查詢。",
                )

        except MergeInputInvalid:
            return ResponseFormatter.error_response(
                    code= "payload or parameter not insufficent.",
                    http_status= status.HTTP_400_BAD_REQUEST,
                    message= "查詢條件不足，請客戶填寫查詢條件",
                )


        except Exception as e:
            return ResponseFormatter.error_response(
                    code= "internal_server_error",
                    http_status= status.HTTP_500_INTERNAL_SERVER_ERROR,
                    message= "查詢失敗，請稍後再試。",
                )
