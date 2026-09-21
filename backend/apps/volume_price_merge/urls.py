from django.urls import path

from .api.views.status_view import VolumePriceMergeView
from .api.views.pairing_view import PairingView


app_name = "volume_price_merge"

urlpatterns = [
    path("", VolumePriceMergeView.as_view(), name="status"),
    path("jobs/", PairingView.as_view(), name="pairing"),
]

