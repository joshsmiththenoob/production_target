from django.urls import include, path

version = "v1"


urlpatterns = [
    path(f"api/{version}/health/", include("apps.health.urls")),
    path(f"api/{version}/price-volume-merge/", include("apps.volume_price_merge.urls")),
]

