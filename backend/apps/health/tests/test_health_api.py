from unittest.mock import patch
from django.db import OperationalError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class HealthApiTests(APITestCase):
    def test_health_returns_database_connection_status(self) -> None:
        response = self.client.get(reverse("health:status"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {
                "status": "ok",
                "service": "production-target-backend",
                "database": "connected",
                "api_version": "v1",
            },
        )

    @patch("apps.health.service.connection.cursor", side_effect=OperationalError)
    def test_health_returns_503_when_database_is_unavailable(self, _) -> None:
        response = self.client.get(reverse("health:status"))

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json()["status"], "error")
        self.assertEqual(response.json()["database"], "unavailable")

