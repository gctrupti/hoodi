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

class SimulatePaymentView(APIView):
    """
    Simulate end-to-end payment:
    Razorpay order -> capture -> 10-20% commission by category -> helper/teacher wallet credit.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        amount_raw = request.data.get("amount")
        recipient_id = request.data.get("recipient_id")
        category = request.data.get("category", "delivery")

        if not amount_raw or not recipient_id:
            return Response({"error": "amount and recipient_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            total_amount = Decimal(str(amount_raw))
            recipient = User.objects.get(pk=recipient_id)
        except (ValueError, User.DoesNotExist):
            return Response({"error": "Invalid amount or recipient not found"}, status=status.HTTP_400_BAD_REQUEST)

        # Commission rules: 15% for delivery/transport, 10% for home_assistance, 20% for skills
        commission_rates = {
            "delivery": Decimal("0.15"),
            "transport": Decimal("0.15"),
            "home_assistance": Decimal("0.10"),
            "skills": Decimal("0.20"),
        }
        rate = commission_rates.get(category, Decimal("0.15"))
        platform_fee = round(total_amount * rate, 2)
        net_credit = total_amount - platform_fee

        # Credit recipient's wallet
        wallet, _ = Wallet.objects.get_or_create(user=recipient)
        wallet.balance += net_credit
        wallet.save()

        # Record transaction
        tx = WalletTransaction.objects.create(
            wallet=wallet,
            amount=net_credit,
            transaction_type="credit",
            description=f"Payment for {category} task (less {int(rate*100)}% platform fee)",
            reference_id=f"SIM_{wallet.id.hex[:8].upper()}"
        )

        return Response({
            "status": "captured",
            "simulation": True,
            "order_id": f"order_sim_{wallet.id.hex[:12]}",
            "payment_id": f"pay_sim_{tx.id.hex[:12]}",
            "total_amount": float(total_amount),
            "platform_commission": float(platform_fee),
            "net_credited_to_helper": float(net_credit),
            "recipient_wallet_balance": float(wallet.balance),
        })
