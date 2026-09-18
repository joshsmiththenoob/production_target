"""

"""

from django.shortcuts import render
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from ..services.pairing_service import PairingService
from ..serializers.pairing_serializer import PairingUploadSerializer



# Create your views here.

class PairingView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []
    parser_classes = (MultiPartParser, FormParser)
    serializer_class = PairingUploadSerializer

    def post(self, request: Request) -> Response:
        compare_service = PairingService()
        response = compare_service.check()

        if (response["status"] == "ok"):
            return Response(data= response,
                            status = status.HTTP_200_OK)        
        else:
            return Response(data= response,
                            status = status.HTTP_503_SERVICE_UNAVAILABLE)
