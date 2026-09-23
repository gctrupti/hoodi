class ServiceCategoryModel {
  final String id;
  final String name;
  final String slug;
  final String icon;
  final String? description;

  ServiceCategoryModel({
    required this.id,
    required this.name,
    required this.slug,
    required this.icon,
    this.description,
  });

  factory ServiceCategoryModel.fromJson(Map<String, dynamic> json) {
    return ServiceCategoryModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      icon: json['icon'] as String? ?? 'Wrench',
      description: json['description'] as String?,
    );
  }
}

class ServiceListingModel {
  final String id;
  final String providerId;
  final String providerName;
  final bool isVerifiedProvider;
  final double providerRating;
  final String title;
  final String description;
  final String categoryName;
  final String pricingType;
  final double basePrice;
  final int estimatedDurationMins;
  final double serviceRadiusKm;
  final double? distanceKm;
  final int completedJobs;

  ServiceListingModel({
    required this.id,
    required this.providerId,
    required this.providerName,
    required this.isVerifiedProvider,
    required this.providerRating,
    required this.title,
    required this.description,
    required this.categoryName,
    required this.pricingType,
    required this.basePrice,
    required this.estimatedDurationMins,
    required this.serviceRadiusKm,
    this.distanceKm,
    this.completedJobs = 0,
  });

  factory ServiceListingModel.fromJson(Map<String, dynamic> json) {
    final prov = json['provider'] as Map<String, dynamic>? ?? {};
    final cat = json['category'] as Map<String, dynamic>? ?? {};

    return ServiceListingModel(
      id: json['id'] as String? ?? '',
      providerId: json['provider_id'] as String? ?? prov['user_id'] as String? ?? '',
      providerName: prov['business_name'] as String? ?? json['business_name'] as String? ?? 'Local Expert',
      isVerifiedProvider: prov['is_verified_provider'] as bool? ?? json['is_verified_provider'] as bool? ?? false,
      providerRating: (prov['rating'] as num?)?.toDouble() ?? (json['rating'] as num?)?.toDouble() ?? 5.0,
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      categoryName: cat['name'] as String? ?? json['category_name'] as String? ?? 'Service',
      pricingType: json['pricing_type'] as String? ?? 'starting_from',
      basePrice: (json['base_price'] as num?)?.toDouble() ?? 499.0,
      estimatedDurationMins: json['estimated_duration_mins'] as int? ?? 60,
      serviceRadiusKm: (json['service_area_radius_km'] as num?)?.toDouble() ?? 10.0,
      distanceKm: (json['distance_km'] as num?)?.toDouble(),
      completedJobs: json['completed_jobs'] as int? ?? 0,
    );
  }
}

class ServiceBookingModel {
  final String id;
  final String title;
  final String description;
  final String scheduledDate;
  final String scheduledTimeSlot;
  final String address;
  final String status;
  final double? finalPrice;
  final double? budget;
  final String providerName;

  ServiceBookingModel({
    required this.id,
    required this.title,
    required this.description,
    required this.scheduledDate,
    required this.scheduledTimeSlot,
    required this.address,
    required this.status,
    this.finalPrice,
    this.budget,
    required this.providerName,
  });

  factory ServiceBookingModel.fromJson(Map<String, dynamic> json) {
    final prov = json['provider'] as Map<String, dynamic>? ?? {};

    return ServiceBookingModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      scheduledDate: json['scheduled_date'] as String? ?? '',
      scheduledTimeSlot: json['scheduled_time_slot'] as String? ?? 'morning',
      address: json['address'] as String? ?? '',
      status: json['status'] as String? ?? 'requested',
      finalPrice: (json['final_price'] as num?)?.toDouble(),
      budget: (json['budget'] as num?)?.toDouble(),
      providerName: prov['business_name'] as String? ?? 'Provider',
    );
  }
}
