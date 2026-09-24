from django.urls import path

from .api.views.status_view import VolumePriceMergeView
from .api.views.pairing_view import PairingView
from .api.views.merging_view import MergingView


app_name = "volume_price_merge"

urlpatterns = [
    path("", VolumePriceMergeView.as_view(), name="status"),
    path("jobs/", PairingView.as_view(), name="pairing"),
    path("jobs/<uuid:public_id>/run/",MergingView.as_view(), name="merging")
]

