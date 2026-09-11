from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from .service import HealthService


class HealthView(APIView):
    authentication_classes: list[type] = []
    permission_classes: list[type] = []

    def get(self, request: Request) -> Response:
        del request
        response = HealthService().check()

        if (response["status"] == "ok"):
            return Response(data= response,
                            status = status.HTTP_200_OK)        
        else:
            return Response(data= response,
                            status = status.HTTP_503_SERVICE_UNAVAILABLE)


