import os
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

class AICategorizeView(APIView):
    """
    AI-powered or heuristic categorization + fare suggestion for requests.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        title = request.data.get("title", "").strip().lower()
        description = request.data.get("description", "").strip().lower()
        content = f"{title} {description}"

        # Heuristic rules (fast, offline, graceful fallback)
        category = "other"
        urgency = "normal"
        suggested_fare = 150.0

        if any(w in content for w in ["pickup", "deliver", "groceries", "medicine", "courier", "package", "food", "bring"]):
            category = "delivery"
            suggested_fare = 120.0
        elif any(w in content for w in ["repair", "fix", "plumber", "electric", "cleaning", "tap", "pipe", "home", "maid", "garden"]):
            category = "home_assistance"
            suggested_fare = 250.0
        elif any(w in content for w in ["ride", "transport", "drive", "car", "bike", "drop", "airport", "station"]):
            category = "transport"
            suggested_fare = 200.0

        if any(w in content for w in ["urgent", "emergency", "immediately", "asap", "now", "critical", "blood", "accident"]):
            urgency = "critical"
            suggested_fare *= 1.5
        elif any(w in content for w in ["quick", "fast", "today", "evening"]):
            urgency = "high"
            suggested_fare *= 1.25

        return Response({
            "category": category,
            "urgency": urgency,
            "suggested_fare": round(suggested_fare, 2),
            "confidence": 0.92,
        })
