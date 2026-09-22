class HelpRequest {
  final String id;
  final String title;
  final String? description;
  final String category;
  final String urgency;
  final String status;
  final String? deliveryStage;
  final double fareAmount;
  final double? finalFare;
  final String? pickupAddress;
  final String? dropoffAddress;
  final String? requesterId;
  final String? requesterName;
  final String? helperId;
  final String? helperName;
  final String? proofPhotoUrl;
  final DateTime createdAt;

  HelpRequest({
    required this.id,
    required this.title,
    this.description,
    required this.category,
    required this.urgency,
    required this.status,
    this.deliveryStage,
    required this.fareAmount,
    this.finalFare,
    this.pickupAddress,
    this.dropoffAddress,
    this.requesterId,
    this.requesterName,
    this.helperId,
    this.helperName,
    this.proofPhotoUrl,
    required this.createdAt,
  });

  bool get isOpen => status == 'open';
  bool get isAssigned => status == 'accepted';
  bool get isInProgress => status == 'in_progress' && deliveryStage != 'picked_up';
  bool get isArrived => status == 'in_progress' && deliveryStage == 'picked_up';
  bool get isCompleted => status == 'completed';
  bool get isCancelled => status == 'cancelled';

  factory HelpRequest.fromJson(Map<String, dynamic> json) {
    return HelpRequest(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? 'Untitled Task',
      description: json['description'],
      category: json['category'] ?? 'errand',
      urgency: json['urgency'] ?? 'normal',
      status: json['status'] ?? 'open',
      deliveryStage: json['delivery_stage']?.toString(),
      fareAmount: (json['estimated_fare'] is num)
          ? (json['estimated_fare'] as num).toDouble()
          : (json['fare_amount'] is num)
              ? (json['fare_amount'] as num).toDouble()
              : double.tryParse(json['estimated_fare']?.toString() ?? json['fare_amount']?.toString() ?? '150') ?? 150.0,
      finalFare: json['final_fare'] != null ? (json['final_fare'] as num).toDouble() : null,
      pickupAddress: json['address_text'] ?? json['pickup_address'] ?? json['address'],
      dropoffAddress: json['dropoff_address'],
      requesterId: json['requester_id']?.toString(),
      requesterName: json['requester'] != null && json['requester']['name'] != null
          ? json['requester']['name']
          : json['profiles'] != null && json['profiles']['name'] != null
              ? json['profiles']['name']
              : 'Neighbor',
      helperId: json['helper_id']?.toString(),
      helperName: json['helper'] != null && json['helper']['name'] != null
          ? json['helper']['name']
          : null,
      proofPhotoUrl: json['photo_url']?.toString(),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at']) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'description': description,
      'category': category,
      'urgency': urgency,
      'status': status,
      'delivery_stage': deliveryStage,
      'fare_amount': fareAmount,
      'pickup_address': pickupAddress,
      'dropoff_address': dropoffAddress,
      'photo_url': proofPhotoUrl,
    };
  }
}
