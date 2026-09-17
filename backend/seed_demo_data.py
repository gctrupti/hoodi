import os
import django
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hoodi_backend.settings")
django.setup()

from accounts.models import User
from help_requests.models import HelpRequest
from skills.models import TeacherProfile, SkillOffering
from payments.models import Wallet

print("Seeding demo data...")

# 1. Users
admin, _ = User.objects.get_or_create(
    email="admin@hoodi.com",
    defaults={
        "full_name": "Admin User",
        "is_staff": True,
        "is_superuser": True,
        "is_admin_user": True,
    }
)
admin.set_password("admin123")
admin.save()

helper, _ = User.objects.get_or_create(
    email="helper@hoodi.com",
    defaults={
        "full_name": "Ravi Kumar",
        "phone": "+91 98765 43210",
        "is_helper": True,
        "is_verified": True,
        "rating": 4.9,
        "completed_tasks_count": 14,
        "latitude": 12.9716,
        "longitude": 77.5946,
        "address": "MG Road, Bengaluru",
    }
)
helper.set_password("helper123")
helper.save()

requester, _ = User.objects.get_or_create(
    email="requester@hoodi.com",
    defaults={
        "full_name": "Priya Sharma",
        "phone": "+91 91234 56789",
        "is_verified": True,
        "latitude": 12.9750,
        "longitude": 77.6000,
        "address": "Indiranagar, Bengaluru",
    }
)
requester.set_password("requester123")
requester.save()

# 2. Wallets
Wallet.objects.get_or_create(user=admin, defaults={"balance": Decimal("5000.00")})
Wallet.objects.get_or_create(user=helper, defaults={"balance": Decimal("1250.00")})
Wallet.objects.get_or_create(user=requester, defaults={"balance": Decimal("2500.00")})

# 3. Help Requests (within ~1.2 km of Bengaluru center)
HelpRequest.objects.get_or_create(
    title="Urgent Medicine Pickup from Apollo Pharmacy",
    requester=requester,
    defaults={
        "description": "Need BP medicine picked up from Apollo 100ft Road and delivered to 12th Main.",
        "category": "delivery",
        "urgency": "high",
        "fare_amount": Decimal("180.00"),
        "status": "open",
        "pickup_address": "Apollo Pharmacy, 100ft Road, Indiranagar",
        "pickup_latitude": 12.9730,
        "pickup_longitude": 77.6020,
    }
)

HelpRequest.objects.get_or_create(
    title="Kitchen Sink Pipe Leak Repair",
    requester=requester,
    defaults={
        "description": "Pipe leaking under kitchen sink. Looking for a neighbor with plumbing tools.",
        "category": "home_assistance",
        "urgency": "normal",
        "fare_amount": Decimal("350.00"),
        "status": "open",
        "pickup_address": "Indiranagar 12th Main",
        "pickup_latitude": 12.9760,
        "pickup_longitude": 77.6010,
    }
)

# 4. Teacher & Skill Offerings
teacher_profile, _ = TeacherProfile.objects.get_or_create(
    user=helper,
    defaults={
        "headline": "Full-Stack Dev & Classical Guitar Instructor",
        "bio": "Software engineer by day, musician by evening. Teaching beginners guitar and Python.",
        "experience_years": 5,
        "hourly_rate": Decimal("600.00"),
        "is_approved": True,
    }
)

SkillOffering.objects.get_or_create(
    teacher=teacher_profile,
    title="Beginner Acoustic Guitar Chords & Fingerstyle",
    defaults={
        "description": "1-on-1 personalized acoustic guitar lesson for absolute beginners.",
        "category": "music",
        "duration_minutes": 60,
        "price": Decimal("600.00"),
        "is_online": True,
        "is_in_person": True,
    }
)

print("Demo data seeded successfully!")
