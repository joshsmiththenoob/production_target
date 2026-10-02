"""
Duty on Merging prduction/area informations after checking sucessful pairing result from client.
"""
from uuid import UUID

from django.shortcuts import render
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
# Most customization cases should be covered by the extend_schema decorator.
from drf_spectacular.utils import extend_schema
from apps.volume_price_merge.api.services.merging_service import MergingService, MergeJobExpired, MergeJobNotRunnable
from apps.volume_price_merge.api.serializers.merging_serializer import MergingSummaryResponseSerializer
from apps.jobs.models import Job
from config.utils.response_formatter import ResponseFormatter
from config.utils.response_serializers import ErrorResponseSerializer

# Create your views here.

class MergingView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []
    serializer_class = MergingSummaryResponseSerializer

    
    @extend_schema(
        summary="執行生產量值整併",
        responses={
            201: MergingSummaryResponseSerializer,
            404: ErrorResponseSerializer,
            409: ErrorResponseSerializer,
            410: ErrorResponseSerializer,
            500: ErrorResponseSerializer,
        },
        tags=["Volume Price Merge"],
    )

    def post(self, request: Request, public_id: UUID):
        # Don't need intput serailizer cause dynamic URL parameter
        # help us to check data type from client (React)
        
        try:
            merging_service = MergingService()
            result = merging_service.run(public_id)
            print(result)
            output_serializer = MergingSummaryResponseSerializer(data= result)
            output_serializer.is_valid(raise_exception= True)
            return ResponseFormatter.success_response(
                    data= output_serializer.validated_data,
                    http_status= status.HTTP_200_OK,
                    message= "合併完成。",

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

        except MergeJobNotRunnable:
            return ResponseFormatter.error_response(
                    code= "job_not_runnable",
                    http_status= status.HTTP_409_CONFLICT,
                    message= "目前的工作狀態無法執行合併。",
                )

        except Exception as e:
            print(e)
            return ResponseFormatter.error_response(
                    code= "internal_server_error",
                    http_status= status.HTTP_500_INTERNAL_SERVER_ERROR,
                    message= "合併處理失敗，請稍後再試。",
                )


