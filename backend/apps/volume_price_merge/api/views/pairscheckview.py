""

from django.shortcuts import render
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from ..services.status_service import VolumePriceMergeService

# Create your views here.

class VolumePriceMergeView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []

    def get(self, request: Request) -> Response:
        return Response(data = {
            "status": "ok",
            "service": "production-target-backend",
            "database": "unavailable",
            "api_version": "v1",  
        })