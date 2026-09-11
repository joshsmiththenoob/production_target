from django.db import DatabaseError, connection



class HealthService:
    def check(self) -> dict:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                database_connected = cursor.fetchone() == (1,)
        except DatabaseError:
            database_connected = False
   
        if not database_connected:
            return {
                        "status": "error",
                        "service": "production-target-backend",
                        "database": "unavailable",
                        "api_version": "v1",
                    }

        return  {
                "status": "ok",
                "service": "production-target-backend",
                "database": "connected",
                "api_version": "v1",
                }
 