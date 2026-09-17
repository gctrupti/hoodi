import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, blank=True, null=True)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    avatar_url = models.URLField(max_length=1000, blank=True)
    cover_url = models.URLField(max_length=1000, blank=True)
    bio = models.TextField(blank=True)
    
    # Geolocation for neighborhood discovery
    address = models.CharField(max_length=500, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    
    # Roles and verification
    is_verified = models.BooleanField(default=False)
    is_helper = models.BooleanField(default=False)
    is_teacher = models.BooleanField(default=False)
    is_admin_user = models.BooleanField(default=False)
    
    # Reputation
    rating = models.FloatField(default=5.0)
    completed_tasks_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email
