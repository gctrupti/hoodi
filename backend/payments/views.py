from decimal import Decimal
from rest_framework import serializers, generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Wallet, WalletTransaction
from accounts.models import User

class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ["id", "amount", "transaction_type", "description", "reference_id", "created_at"]

class WalletSerializer(serializers.ModelSerializer):
    transactions = WalletTransactionSerializer(many=True, read_only=True)

    class Meta:
        model = Wallet
        fields = ["id", "balance", "currency", "transactions", "created_at", "updated_at"]

class MyWalletView(generics.RetrieveAPIView):
    serializer_class = WalletSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        wallet, _ = Wallet.objects.get_or_create(user=self.request.user)
        return wallet

from services_domain import PaymentLedgerService, HoodiDomainException

class SimulatePaymentView(APIView):
    """
    Simulate end-to-end payment:
    Razorpay order -> capture -> 10-20% commission by category -> helper/teacher wallet credit.
    Executed via PaymentLedgerService with atomic row-level locks and transaction safety.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        amount_raw = request.data.get("amount")
        recipient_id = request.data.get("recipient_id")
        category = request.data.get("category", "delivery")
        task_id = request.data.get("task_id", "")

        if not amount_raw or not recipient_id:
            return Response({"error": "amount and recipient_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            total_amount = Decimal(str(amount_raw))
            recipient = User.objects.get(pk=recipient_id)
        except (ValueError, User.DoesNotExist):
            return Response({"error": "Invalid amount or recipient not found"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            settle_result = PaymentLedgerService.settle_task_earnings(
                recipient_user=recipient,
                total_amount=total_amount,
                category=category,
                task_id=task_id,
            )

            tx_id_str = str(settle_result["transaction_id"])
            return Response({
                "status": "captured",
                "simulation": True,
                "order_id": f"order_sim_{tx_id_str[:12]}",
                "payment_id": f"pay_sim_{tx_id_str[:12]}",
                "total_amount": settle_result["total_amount"],
                "platform_commission": settle_result["platform_commission"],
                "commission_rate": settle_result["commission_rate"],
                "net_credited_to_helper": settle_result["net_credited"],
                "recipient_wallet_balance": settle_result["recipient_wallet_balance"],
                "transaction_id": tx_id_str,
            })
        except HoodiDomainException as e:
            return Response({"error": e.message, "code": e.code}, status=e.status_code)
