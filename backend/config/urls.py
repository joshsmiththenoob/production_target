from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

version = "v1"


urlpatterns = [
    path(f"api/{version}/health/", include("apps.health.urls")),
    path(f"api/{version}/price-volume-merge/", include("apps.volume_price_merge.urls")),

    # Standard View of API docs' packages, ex: Swagger, Redoc
    # -> To provide standard schema
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="swagger-ui",),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="api-schema"), name="redoc",),
]

