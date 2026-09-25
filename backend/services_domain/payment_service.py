"""
PaymentLedgerService: Domain service managing wallets, transactions, commission calculations,
and strict transactional ledger consistency.
"""
from decimal import Decimal
from typing import Dict, Any, Optional
from django.db import transaction
from payments.models import Wallet, WalletTransaction
from .exceptions import InsufficientFundsException, HoodiDomainException

COMMISSION_RATES = {
    "delivery": Decimal("0.15"),
    "transport": Decimal("0.15"),
    "home_assistance": Decimal("0.10"),
    "services": Decimal("0.10"),
    "skills": Decimal("0.20"),
    "other": Decimal("0.15"),
}

class PaymentLedgerService:
    @staticmethod
    def get_or_create_wallet(user) -> Wallet:
        """Retrieves or initializes a user's wallet."""
        wallet, _ = Wallet.objects.get_or_create(user=user)
        return wallet

    @classmethod
    def credit_wallet(
        cls,
        user,
        amount: Decimal,
        description: str,
        reference_id: str = ""
    ) -> Dict[str, Any]:
        """
        Credits a wallet with strict row-level lock and transaction safety.
        """
        if amount <= Decimal("0.00"):
            raise HoodiDomainException("Credit amount must be positive.", code="invalid_amount")

        with transaction.atomic():
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user=user)
            wallet.balance += amount
            wallet.save(update_fields=["balance", "updated_at"])

            tx = WalletTransaction.objects.create(
                wallet=wallet,
                amount=amount,
                transaction_type="credit",
                description=description,
                reference_id=reference_id
            )

            return {
                "wallet_id": wallet.id,
                "transaction_id": tx.id,
                "amount": amount,
                "new_balance": wallet.balance,
                "type": "credit",
            }

    @classmethod
    def debit_wallet(
        cls,
        user,
        amount: Decimal,
        description: str,
        reference_id: str = ""
    ) -> Dict[str, Any]:
        """
        Debits a wallet with strict row-level lock and balance check.
        """
        if amount <= Decimal("0.00"):
            raise HoodiDomainException("Debit amount must be positive.", code="invalid_amount")

        with transaction.atomic():
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user=user)

            if wallet.balance < amount:
                raise InsufficientFundsException(
                    f"Insufficient balance. Current: {wallet.currency} {wallet.balance}, Requested: {wallet.currency} {amount}"
                )

            wallet.balance -= amount
            wallet.save(update_fields=["balance", "updated_at"])

            tx = WalletTransaction.objects.create(
                wallet=wallet,
                amount=amount,
                transaction_type="debit",
                description=description,
                reference_id=reference_id
            )

            return {
                "wallet_id": wallet.id,
                "transaction_id": tx.id,
                "amount": amount,
                "new_balance": wallet.balance,
                "type": "debit",
            }

    @classmethod
    def settle_task_earnings(
        cls,
        recipient_user,
        total_amount: Decimal,
        category: str = "delivery",
        task_id: str = ""
    ) -> Dict[str, Any]:
        """
        Deducts platform commission based on category and credits the helper's wallet.
        """
        if total_amount <= Decimal("0.00"):
            raise HoodiDomainException("Settlement amount must be positive.", code="invalid_amount")

        rate = COMMISSION_RATES.get(category, Decimal("0.15"))
        platform_fee = round(total_amount * rate, 2)
        net_credit = total_amount - platform_fee

        ref_id = f"SETTLE_{str(task_id)[:8].upper()}" if task_id else "SETTLE_GENERIC"
        desc = f"Payout for {category} task (less {int(rate * 100)}% platform commission)"

        credit_result = cls.credit_wallet(
            user=recipient_user,
            amount=net_credit,
            description=desc,
            reference_id=ref_id
        )

        return {
            "total_amount": float(total_amount),
            "platform_commission": float(platform_fee),
            "commission_rate": float(rate),
            "net_credited": float(net_credit),
            "recipient_wallet_balance": float(credit_result["new_balance"]),
            "transaction_id": credit_result["transaction_id"],
        }
