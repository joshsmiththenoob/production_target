from django.urls import path

# from .api.views.status_view import VolumePriceMergeView
from .api.views.comparison_preview_view import ComparisonPreviewView
from .api.views.comparing_view import ComparingView
# from .api.views.merging_view import MergingView
# from .api.views.merging_result_view import MergingResultView
# from .api.views.merging_download_view import MergingDownloadView


app_name = "table_compare"

urlpatterns = [
    path("jobs/", ComparisonPreviewView.as_view(), name="comparison-preview"),
    path("jobs/<uuid:public_id>/run/",ComparingView.as_view(), name="comparing")
    # path("jobs/<uuid:public_id>/run/",MergingView.as_view(), name="merging"),
    # path("jobs/<uuid:public_id>/result/",MergingResultView.as_view(), name="query"),
    # path("jobs/<uuid:public_id>/download/",MergingDownloadView.as_view(), name="download")
]