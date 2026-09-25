from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import HelpRequest, ChatMessage, LocationTracking, calculate_distance_km
from .serializers import HelpRequestSerializer, ChatMessageSerializer, LocationTrackingSerializer

from services_domain import (
    HelpRequestService,
    MatchingService,
    HoodiDomainException,
)

class HelpRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = HelpRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        mine = self.request.query_params.get("mine")
        req_status = self.request.query_params.get("status")

        qs = HelpRequest.objects.all()
        if mine == "true":
            qs = qs.filter(requester=user)
        elif mine == "accepted":
            qs = qs.filter(helper=user)
        
        if req_status:
            qs = qs.filter(status=req_status)
        return qs

    def perform_create(self, serializer):
        serializer.save(requester=self.request.user, status="open")

class NearbyHelpRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        lat = request.query_params.get("latitude")
        lon = request.query_params.get("longitude")
        radius_raw = request.query_params.get("radius") or request.query_params.get("radius_km") or 5.0
        try:
            radius = float(radius_raw)
        except ValueError:
            radius = 5.0
        category = request.query_params.get("category")
        urgency = request.query_params.get("urgency")

        if not lat or not lon:
            return Response({"error": "latitude and longitude are required query parameters"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_lat = float(lat)
            user_lon = float(lon)
        except ValueError:
            return Response({"error": "Invalid coordinates"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            matched = MatchingService.find_nearby_requests(
                current_user=request.user,
                latitude=user_lat,
                longitude=user_lon,
                radius_km=radius,
                category=category,
                urgency=urgency,
            )
            data = []
            for item in matched:
                serialized = HelpRequestSerializer(item["request"], context={"request": request}).data
                serialized["distance_km"] = item["distance_km"]
                data.append(serialized)
            return Response(data)
        except HoodiDomainException as e:
            return Response({"error": e.message}, status=e.status_code)

class HelpRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = HelpRequest.objects.all()
    serializer_class = HelpRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

class AcceptTaskView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            help_req = HelpRequestService.accept_request(request_id=pk, helper=request.user)
            return Response(HelpRequestSerializer(help_req, context={"request": request}).data)
        except HoodiDomainException as e:
            return Response({"error": e.message, "code": e.code}, status=e.status_code)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UpdateTaskStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        new_status = request.data.get("status")
        if not new_status:
            return Response({"error": "status is required in request body"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            help_req = HelpRequestService.transition_status(
                request_id=pk,
                user=request.user,
                new_status=new_status
            )
            return Response(HelpRequestSerializer(help_req, context={"request": request}).data)
        except HoodiDomainException as e:
            return Response({"error": e.message, "code": e.code}, status=e.status_code)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ChatMessageListCreateView(generics.ListCreateAPIView):
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        request_id = self.kwargs["pk"]
        return ChatMessage.objects.filter(request_id=request_id)

    def perform_create(self, serializer):
        request_id = self.kwargs["pk"]
        serializer.save(sender=self.request.user, request_id=request_id)

class LocationTrackingView(generics.CreateAPIView):
    serializer_class = LocationTrackingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        request_id = self.kwargs["pk"]
        serializer.save(helper=self.request.user, request_id=request_id)
