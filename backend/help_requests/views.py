from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import HelpRequest, ChatMessage, LocationTracking, calculate_distance_km
from .serializers import HelpRequestSerializer, ChatMessageSerializer, LocationTrackingSerializer

class HelpRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = HelpRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Allow filtering: ?mine=true or ?status=open
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
        radius = float(request.query_params.get("radius", 5.0))

        if not lat or not lon:
            return Response({"error": "latitude and longitude are required query parameters"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_lat = float(lat)
            user_lon = float(lon)
        except ValueError:
            return Response({"error": "Invalid coordinates"}, status=status.HTTP_400_BAD_REQUEST)

        open_requests = HelpRequest.objects.filter(status="open").exclude(requester=request.user)
        nearby = []

        for req in open_requests:
            if req.pickup_latitude is not None and req.pickup_longitude is not None:
                dist = calculate_distance_km(user_lat, user_lon, req.pickup_latitude, req.pickup_longitude)
                if dist is not None and dist <= radius:
                    serialized = HelpRequestSerializer(req, context={"request": request}).data
                    serialized["distance_km"] = dist
                    nearby.append(serialized)

        nearby.sort(key=lambda x: x["distance_km"])
        return Response(nearby)

class HelpRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = HelpRequest.objects.all()
    serializer_class = HelpRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

class AcceptTaskView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            help_req = HelpRequest.objects.get(pk=pk)
        except HelpRequest.DoesNotExist:
            return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)

        if help_req.requester == request.user:
            return Response({"error": "Cannot accept your own request"}, status=status.HTTP_400_BAD_REQUEST)

        if help_req.status != "open":
            return Response({"error": f"Request is not open for acceptance (current status: {help_req.status})"}, status=status.HTTP_400_BAD_REQUEST)

        help_req.helper = request.user
        help_req.status = "accepted"
        help_req.save()
        return Response(HelpRequestSerializer(help_req, context={"request": request}).data)

class UpdateTaskStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            help_req = HelpRequest.objects.get(pk=pk)
        except HelpRequest.DoesNotExist:
            return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("status")
        if new_status not in ["in_progress", "completed", "cancelled"]:
            return Response({"error": "Invalid status. Allowed: in_progress, completed, cancelled"}, status=status.HTTP_400_BAD_REQUEST)

        # Check authorization
        if request.user not in (help_req.requester, help_req.helper):
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        help_req.status = new_status
        if new_status == "completed":
            help_req.completed_at = timezone.now()
            if help_req.helper:
                help_req.helper.completed_tasks_count += 1
                help_req.helper.save()

        help_req.save()
        return Response(HelpRequestSerializer(help_req, context={"request": request}).data)

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
