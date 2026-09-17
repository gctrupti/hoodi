from django.urls import path
from .views import MyWalletView, SimulatePaymentView

urlpatterns = [
    path("wallet/", MyWalletView.as_view(), name="my-wallet"),
    path("simulate/", SimulatePaymentView.as_view(), name="simulate-payment"),
]
