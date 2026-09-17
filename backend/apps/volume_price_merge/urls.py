from django.urls import path

from .api.views.status_view import VolumePriceMergeView


app_name = "health"

urlpatterns = [
    path("", VolumePriceMergeView.as_view(), name="status"),
]

