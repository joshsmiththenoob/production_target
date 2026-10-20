from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from config.utils.response_formatter import ResponseFormatter
from config.utils.response_serializers import ErrorResponseSerializer

from ..serializers.comparing_serializer import (
    ComparisonPreviewDataSerializer,
    ComparisonPreviewResponseSerializer,
    ComparisonPreviewUploadSerializer,
)
from ..services.comparing_service import ComparisonInputError, ComparingService


class ComparisonPreviewView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []
    parser_classes = (MultiPartParser, FormParser)
    serializer_class = ComparisonPreviewUploadSerializer

    @extend_schema(
        summary="預覽 Excel 與 PDF 的可比對範圍",
        request=ComparisonPreviewUploadSerializer,
        responses={
            200: ComparisonPreviewResponseSerializer,
            400: ErrorResponseSerializer,
        },
        tags=["Table Compare"],
    )
    def post(self, request: Request) -> Response:
        serializer = self.serializer_class(data=request.data)
        if not serializer.is_valid():
            return ResponseFormatter.error_response(
                code="invalid_upload",
                http_status=status.HTTP_400_BAD_REQUEST,
                message="請檢查上傳的 Excel 與 PDF 檔案。",
                field_errors=serializer.errors,
            )

        try:
            preview = ComparingService().build_preview(
                **serializer.validated_data
            )
        except ComparisonInputError as error:
            return ResponseFormatter.error_response(
                code="invalid_preview",
                http_status=status.HTTP_400_BAD_REQUEST,
                message=str(error),
            )

        output = ComparisonPreviewDataSerializer(instance=preview)
        return ResponseFormatter.success_response(
            data=output.data,
            http_status=status.HTTP_200_OK,
            message="比對範圍預覽完成。",
        )
