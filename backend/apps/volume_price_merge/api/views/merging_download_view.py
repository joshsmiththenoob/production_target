"""
Duty on Merging prduction/area informations after checking sucessful pairing result from client.
"""
from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import FileResponse

from apps.jobs.models import Job
from apps.volume_price_merge.api.serializers.merging_download_serializer import (
    MergeDownloadRequestSerializer
)
from apps.volume_price_merge.api.serializers.merging_serializer import(
    MergingSummaryResponseSerializer,
)


from apps.volume_price_merge.api.services.merging_service import (
    MergeJobExpired,
    MergeJobNotInStatus,
    MergingService,
)
from config.utils.response_formatter import ResponseFormatter
from config.utils.response_serializers import ErrorResponseSerializer

# Create your views here.

class MergingDownloadView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []

    
    @extend_schema(
        summary="執行生產量值整併(下載測試)",
        # # request payload
        # request= None,
        parameters= [MergeDownloadRequestSerializer],
        responses={
            200: MergingSummaryResponseSerializer,
            404: ErrorResponseSerializer,
            409: ErrorResponseSerializer,
            410: ErrorResponseSerializer,
            500: ErrorResponseSerializer,
        },
        tags=["Volume Price Merge"],
    )


    def get(self, request: Request, public_id: UUID) -> Response:

        # Input Serializer help us to check query parameters in url from client (React)
        
        # Parse query parameters with serializer
        input_serializer = MergeDownloadRequestSerializer(data= request.query_params)
        input_serializer.is_valid(raise_exception= True)

        print(input_serializer.validated_data)

        merging_service = MergingService()
        merging_service.get_workbook(public_id, input_serializer.validated_data["product"])
        # output_serializer = MergingSummaryDataSerializer(data=result)
        # output_serializer.is_valid(raise_exception= True)

        # file_response = FileResponse(
        #             output,
        #             as_attachment=True,
        #             filename=filename,
        #             content_type=(
        #                 "application/vnd.openxmlformats-officedocument."
        #                 "spreadsheetml.sheet"
        #                 ),
        #             )


        #     return ResponseFormatter.success_response(
        #             data=output_serializer.data,
        #             http_status= status.HTTP_200_OK,
        #             message= "合併完成。",

        #     )

        # except Job.DoesNotExist:
        #     return ResponseFormatter.error_response(
        #             code= "job_not_found",
        #             http_status= status.HTTP_404_NOT_FOUND,
        #             message= "找不到指定的工作。",
        #         )

        # except MergeJobExpired:
        #     return ResponseFormatter.error_response(
        #             code= "job_expired",
        #             http_status= status.HTTP_410_GONE,
        #             message= "工作已過期，請重新上傳檔案。",
        #         )

        # except MergeJobNotInStatus:
        #     return ResponseFormatter.error_response(
        #             code= "job_not_runnable",
        #             http_status= status.HTTP_409_CONFLICT,
        #             message= "目前的工作狀態無法執行合併。",
        #         )

        # except Exception:
        #     return ResponseFormatter.error_response(
        #             code= "internal_server_error",
        #             http_status= status.HTTP_500_INTERNAL_SERVER_ERROR,
        #             message= "合併處理失敗，請稍後再試。",
        #         )

