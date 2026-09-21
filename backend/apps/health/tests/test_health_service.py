from unittest import TestCase
from unittest.mock import MagicMock, patch

from django.db import DatabaseError

from apps.health.service import HealthService


class HealthServiceTests(TestCase):
    @staticmethod
    def _cursor_context(fetch_result: tuple[int, ...]) -> tuple[MagicMock, MagicMock]:
        cursor = MagicMock()
        cursor.fetchone.return_value = fetch_result

        cursor_context = MagicMock()
        cursor_context.__enter__.return_value = cursor
        return cursor_context, cursor

    def test_check_returns_connected_status_when_database_probe_succeeds(self) -> None:
        cursor_context, cursor = self._cursor_context((1,))

        with patch(
            "apps.health.service.connection.cursor",
            return_value=cursor_context,
        ):
            result = HealthService().check()

        cursor.execute.assert_called_once_with("SELECT 1")
        cursor.fetchone.assert_called_once_with()
        self.assertEqual(
            result,
            {
                "status": "ok",
                "service": "production-target-backend",
                "database": "connected",
                "api_version": "v1",
            },
        )

    def test_check_returns_unavailable_status_when_probe_result_is_unexpected(
        self,
    ) -> None:
        cursor_context, cursor = self._cursor_context((0,))

        with patch(
            "apps.health.service.connection.cursor",
            return_value=cursor_context,
        ):
            result = HealthService().check()

        cursor.execute.assert_called_once_with("SELECT 1")
        cursor.fetchone.assert_called_once_with()
        self.assertEqual(
            result,
            {
                "status": "error",
                "service": "production-target-backend",
                "database": "unavailable",
                "api_version": "v1",
            },
        )

    def test_check_returns_unavailable_status_when_database_raises_error(self) -> None:
        with patch(
            "apps.health.service.connection.cursor",
            side_effect=DatabaseError("database unavailable"),
        ):
            result = HealthService().check()

        self.assertEqual(
            result,
            {
                "status": "error",
                "service": "production-target-backend",
                "database": "unavailable",
                "api_version": "v1",
            },
        )
