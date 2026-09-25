"""
MatchingService: Domain service for proximity-based candidate matching and spatial filtering.
Pre-filters coordinates with bounding-box delta and calculates precision distance.
"""
import math
from typing import List, Dict, Any, Optional
from help_requests.models import HelpRequest, calculate_distance_km
from accounts.models import User
from .exceptions import HoodiDomainException

class MatchingService:
    @staticmethod
    def get_bounding_box(lat: float, lon: float, radius_km: float):
        """
        Calculates min/max lat and lon for a given radius in kilometers.
        1 deg latitude ~ 111.32 km.
        1 deg longitude ~ 111.32 km * cos(latitude).
        """
        lat_delta = radius_km / 111.32
        cos_lat = math.cos(math.radians(lat))
        # Protect against division by zero at poles
        lon_delta = radius_km / (111.32 * max(cos_lat, 0.0001))
        
        return {
            "min_lat": lat - lat_delta,
            "max_lat": lat + lat_delta,
            "min_lon": lon - lon_delta,
            "max_lon": lon + lon_delta,
        }

    @classmethod
    def find_nearby_requests(
        cls,
        current_user,
        latitude: float,
        longitude: float,
        radius_km: float = 5.0,
        category: Optional[str] = None,
        urgency: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Finds open help requests near the specified coordinates within radius_km.
        Applies bounding-box pre-filtering at the database level before computing precision distance.
        """
        if not (-90.0 <= latitude <= 90.0) or not (-180.0 <= longitude <= 180.0):
            raise HoodiDomainException("Invalid latitude or longitude coordinates.", code="invalid_coordinates")

        bbox = cls.get_bounding_box(latitude, longitude, radius_km)

        # Database-level query: only fetch open requests within the bounding box
        qs = (
            HelpRequest.objects
            .filter(
                status="open",
                pickup_latitude__gte=bbox["min_lat"],
                pickup_latitude__lte=bbox["max_lat"],
                pickup_longitude__gte=bbox["min_lon"],
                pickup_longitude__lte=bbox["max_lon"],
            )
        )

        if current_user and current_user.is_authenticated:
            qs = qs.exclude(requester_id=current_user.id)

        if category:
            qs = qs.filter(category=category)
        if urgency:
            qs = qs.filter(urgency=urgency)

        results = []
        for req in qs:
            if req.pickup_latitude is not None and req.pickup_longitude is not None:
                dist = calculate_distance_km(latitude, longitude, req.pickup_latitude, req.pickup_longitude)
                if dist is not None and dist <= radius_km:
                    results.append({
                        "request": req,
                        "distance_km": dist
                    })

        results.sort(key=lambda x: x["distance_km"])
        return results

    @classmethod
    def find_nearby_helpers(
        cls,
        center_lat: float,
        center_lon: float,
        radius_km: float = 5.0,
        exclude_user_id=None
    ) -> List[Dict[str, Any]]:
        """
        Finds active verified helpers near the specified coordinates.
        """
        bbox = cls.get_bounding_box(center_lat, center_lon, radius_km)

        qs = User.objects.filter(
            is_active=True,
            is_helper=True,
            latitude__gte=bbox["min_lat"],
            latitude__lte=bbox["max_lat"],
            longitude__gte=bbox["min_lon"],
            longitude__lte=bbox["max_lon"],
        )

        if exclude_user_id:
            qs = qs.exclude(id=exclude_user_id)

        helpers = []
        for user in qs:
            if user.latitude is not None and user.longitude is not None:
                dist = calculate_distance_km(center_lat, center_lon, user.latitude, user.longitude)
                if dist is not None and dist <= radius_km:
                    helpers.append({
                        "helper": user,
                        "distance_km": dist
                    })

        helpers.sort(key=lambda x: x["distance_km"])
        return helpers
