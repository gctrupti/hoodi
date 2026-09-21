class HelpRequest {
  final String id;
  final String title;
  final String? description;
  final String category;
  final String urgency;
  final String status;
  final double fareAmount;
  final String? pickupAddress;
  final String? dropoffAddress;
  final String? requesterId;
  final String? requesterName;
  final DateTime createdAt;

  HelpRequest({
    required this.id,
    required this.title,
    this.description,
    required this.category,
    required this.urgency,
    required this.status,
    required this.fareAmount,
    this.pickupAddress,
    this.dropoffAddress,
    this.requesterId,
    this.requesterName,
    required this.createdAt,
  });

  factory HelpRequest.fromJson(Map<String, dynamic> json) {
    return HelpRequest(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? 'Untitled Task',
      description: json['description'],
      category: json['category'] ?? 'errand',
      urgency: json['urgency'] ?? 'normal',
      status: json['status'] ?? 'open',
      fareAmount: (json['estimated_fare'] is num)
          ? (json['estimated_fare'] as num).toDouble()
          : (json['fare_amount'] is num)
              ? (json['fare_amount'] as num).toDouble()
              : double.tryParse(json['estimated_fare']?.toString() ?? json['fare_amount']?.toString() ?? '150') ?? 150.0,
      pickupAddress: json['address_text'] ?? json['pickup_address'] ?? json['address'],
      dropoffAddress: json['dropoff_address'],
      requesterId: json['requester_id']?.toString(),
      requesterName: json['profiles'] != null && json['profiles']['name'] != null
          ? json['profiles']['name']
          : 'Neighbor',
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
      'fare_amount': fareAmount,
      'pickup_address': pickupAddress,
      'dropoff_address': dropoffAddress,
    };
  }
}
