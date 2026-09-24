"""
Duty on Merging prduction/area informations after checking sucessful pairing result from client.
"""
import uuid

from django.shortcuts import render
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
# Most customization cases should be covered by the extend_schema decorator.
from drf_spectacular.utils import extend_schema
from ..services.merging_service import MergingService
from ..serializers.merging_serializer import MergingSerializer
from config.utils.response_formatter import ResponseFormatter
from config.utils.response_serializers import ErrorResponseSerializer

# Create your views here.

class MergingView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []
    serializer_class = MergingSerializer

    def post(self, request: Request, public_id: uuid):
        # Don't need intput serailizer cause dynamic URL parameter
        # help us to check data type from client (React)
        
        try:
            merging_service = MergingService()
            merging_service.run(public_id)
        except Exception as e:
            print(e)
        