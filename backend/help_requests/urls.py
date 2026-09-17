from django.urls import path
from .views import (
    HelpRequestListCreateView,
    NearbyHelpRequestsView,
    HelpRequestDetailView,
    AcceptTaskView,
    UpdateTaskStatusView,
    ChatMessageListCreateView,
    LocationTrackingView,
)

urlpatterns = [
    path("", HelpRequestListCreateView.as_view(), name="help-requests-list-create"),
    path("nearby/", NearbyHelpRequestsView.as_view(), name="help-requests-nearby"),
    path("<uuid:pk>/", HelpRequestDetailView.as_view(), name="help-request-detail"),
    path("<uuid:pk>/accept/", AcceptTaskView.as_view(), name="help-request-accept"),
    path("<uuid:pk>/status/", UpdateTaskStatusView.as_view(), name="help-request-status"),
    path("<uuid:pk>/chat/", ChatMessageListCreateView.as_view(), name="help-request-chat"),
    path("<uuid:pk>/track/", LocationTrackingView.as_view(), name="help-request-track"),
]
