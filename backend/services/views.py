from decimal import Decimal
from django.db import models
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from .models import (
    calculate_distance_km,
    ServiceCategory,
    ServiceSubcategory,
    ServiceProviderProfile,
    ServiceListing,
    ServiceRequestBooking,
    ServiceQuote,
    ServiceReview,
    ServiceDispute,
)
from .serializers import (
    ServiceCategorySerializer,
    ServiceSubcategorySerializer,
    ServiceProviderProfileSerializer,
    ServiceListingSerializer,
    ServiceRequestBookingSerializer,
    ServiceQuoteSerializer,
    ServiceReviewSerializer,
    ServiceDisputeSerializer,
)
from payments.models import Wallet, WalletTransaction


class CategoryListCreateView(generics.ListCreateAPIView):
    queryset = ServiceCategory.objects.filter(is_active=True)
    serializer_class = ServiceCategorySerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ServiceCategory.objects.all()
    serializer_class = ServiceCategorySerializer

    def get_permissions(self):
        if self.request.method in ["PUT", "PATCH", "DELETE"]:
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]


class ProviderProfileMeView(generics.RetrieveUpdateAPIView):
    serializer_class = ServiceProviderProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, created = ServiceProviderProfile.objects.get_or_create(
            user=self.request.user,
            defaults={"business_name": self.request.user.full_name or self.request.user.email.split("@")[0]}
        )
        return profile


class ProviderProfileDetailView(generics.RetrieveAPIView):
    queryset = ServiceProviderProfile.objects.filter(is_suspended=False)
    serializer_class = ServiceProviderProfileSerializer
    permission_classes = [permissions.AllowAny]


class ServiceListingViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceListingSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = ServiceListing.objects.filter(is_active=True, provider__is_suspended=False).select_related(
            "provider", "category", "subcategory"
        )
        category_slug = self.request.query_params.get("category")
        if category_slug:
            qs = qs.filter(category__slug=category_slug)

        pricing_type = self.request.query_params.get("pricing_type")
        if pricing_type:
            qs = qs.filter(pricing_type=pricing_type)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                models.Q(title__icontains=search)
                | models.Q(description__icontains=search)
                | models.Q(provider__business_name__icontains=search)
            )

        # Distance filtering if coordinates provided
        lat = self.request.query_params.get("latitude")
        lon = self.request.query_params.get("longitude")
        radius = self.request.query_params.get("radius_km")

        if lat and lon and radius:
            try:
                user_lat = float(lat)
                user_lon = float(lon)
                max_radius = float(radius)
                from services_domain.matching_service import MatchingService
                bbox = MatchingService.get_bounding_box(user_lat, user_lon, max_radius)
                qs = qs.filter(
                    provider__latitude__gte=bbox["min_lat"],
                    provider__latitude__lte=bbox["max_lat"],
                    provider__longitude__gte=bbox["min_lon"],
                    provider__longitude__lte=bbox["max_lon"],
                )
            except ValueError:
                pass

        return qs

    def perform_create(self, serializer):
        provider = ServiceProviderProfile.objects.get(user=self.request.user)
        serializer.save(provider=provider)


class ServiceBookingViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceRequestBookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = self.request.query_params.get("role")
        if role == "provider":
            return ServiceRequestBooking.objects.filter(provider__user=user)
        elif role == "customer":
            return ServiceRequestBooking.objects.filter(customer=user)
        return ServiceRequestBooking.objects.filter(
            models.Q(customer=user) | models.Q(provider__user=user)
        )

    def perform_create(self, serializer):
        serializer.save(customer=self.request.user, status="requested")

    @action(detail=True, methods=["post"])
    def send_quote(self, request, pk=None):
        booking = self.get_object()
        if booking.provider.user != request.user:
            return Response({"error": "Only assigned provider can send quote"}, status=status.HTTP_403_FORBIDDEN)

        items = request.data.get("itemized_items", [])
        total_amount = request.data.get("total_amount")
        estimated_duration = request.data.get("estimated_duration", "1-2 hours")
        notes = request.data.get("notes", "")

        if not total_amount:
            return Response({"error": "total_amount is required"}, status=status.HTTP_400_BAD_REQUEST)

        quote = ServiceQuote.objects.create(
            booking=booking,
            provider=booking.provider,
            itemized_items=items,
            total_amount=Decimal(str(total_amount)),
            estimated_duration=estimated_duration,
            notes=notes,
            status="pending",
        )
        booking.status = "quote_sent"
        booking.save()

        return Response(ServiceQuoteSerializer(quote).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def accept_quote(self, request, pk=None):
        booking = self.get_object()
        if booking.customer != request.user:
            return Response({"error": "Only customer can accept quote"}, status=status.HTTP_403_FORBIDDEN)

        quote_id = request.data.get("quote_id")
        try:
            quote = booking.quotes.get(pk=quote_id) if quote_id else booking.quotes.filter(status="pending").latest("created_at")
        except ServiceQuote.DoesNotExist:
            return Response({"error": "Active quote not found"}, status=status.HTTP_404_NOT_FOUND)

        quote.status = "accepted"
        quote.save()

        # Reject any other pending quotes
        booking.quotes.exclude(pk=quote.pk).filter(status="pending").update(status="rejected")

        # Set final price and transition to accepted
        booking.final_price = quote.total_amount
        # Default 10% platform commission
        commission_rate = Decimal("0.10")
        booking.commission_amount = round(quote.total_amount * commission_rate, 2)
        booking.status = "accepted"
        booking.save()

        return Response(ServiceRequestBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def start_service(self, request, pk=None):
        booking = self.get_object()
        if booking.provider.user != request.user:
            return Response({"error": "Only provider can start service"}, status=status.HTTP_403_FORBIDDEN)
        booking.status = "in_progress"
        booking.save()
        return Response(ServiceRequestBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def complete_service(self, request, pk=None):
        booking = self.get_object()
        if booking.provider.user != request.user and booking.customer != request.user:
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        booking.status = "completed"
        booking.completed_at = timezone.now()
        booking.save()

        # Update provider completed jobs count
        booking.provider.completed_jobs_count += 1
        booking.provider.save()

        # Credit provider wallet (Total - Commission)
        if booking.final_price and booking.final_price > 0:
            net_earnings = booking.final_price - booking.commission_amount
            from services_domain.payment_service import PaymentLedgerService
            PaymentLedgerService.credit_wallet(
                user=booking.provider.user,
                amount=net_earnings,
                description=f"Earnings from Service Booking #{booking.id.hex[:8]} (less 10% fee)",
                reference_id=f"SRV_{booking.id.hex[:8].upper()}"
            )

        return Response(ServiceRequestBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def cancel_booking(self, request, pk=None):
        booking = self.get_object()
        if booking.customer != request.user and booking.provider.user != request.user:
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        reason = request.data.get("reason", "Cancelled by user")
        booking.status = "cancelled"
        booking.cancellation_reason = reason
        booking.save()
        return Response(ServiceRequestBookingSerializer(booking).data)


class ServiceReviewCreateView(generics.CreateAPIView):
    serializer_class = ServiceReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        booking = serializer.validated_data["booking"]
        if booking.customer != self.request.user:
            raise permissions.exceptions.PermissionDenied("Only customer can review this service")
        if booking.status != "completed":
            raise serializers.ValidationError("Can only review completed services")

        review = serializer.save(reviewer=self.request.user, provider=booking.provider)

        # Update provider average rating
        reviews = ServiceReview.objects.filter(provider=booking.provider)
        avg_rating = reviews.aggregate(models.Avg("rating"))["rating__avg"]
        if avg_rating:
            booking.provider.rating = round(Decimal(str(avg_rating)), 2)
            booking.provider.save()


class ServiceDisputeCreateView(generics.CreateAPIView):
    serializer_class = ServiceDisputeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        booking = serializer.validated_data["booking"]
        booking.status = "disputed"
        booking.save()
        serializer.save(raised_by=self.request.user)
