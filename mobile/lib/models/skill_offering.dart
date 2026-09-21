class SkillOffering {
  final String id;
  final String title;
  final String? description;
  final String category;
  final double hourlyRate;
  final String level;
  final String teacherName;
  final String? teacherHeadline;
  final double rating;
  final int reviewsCount;

  SkillOffering({
    required this.id,
    required this.title,
    this.description,
    required this.category,
    required this.hourlyRate,
    required this.level,
    required this.teacherName,
    this.teacherHeadline,
    required this.rating,
    required this.reviewsCount,
  });

  factory SkillOffering.fromJson(Map<String, dynamic> json) {
    return SkillOffering(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? 'Skill Lesson',
      description: json['description'],
      category: json['category'] ?? 'General',
      hourlyRate: (json['hourly_rate'] is num)
          ? (json['hourly_rate'] as num).toDouble()
          : double.tryParse(json['hourly_rate']?.toString() ?? '500') ?? 500.0,
      level: json['level'] ?? 'All Levels',
      teacherName: json['teacher_name'] ?? 'Local Instructor',
      teacherHeadline: json['headline'] ?? 'Experienced teacher in Bengaluru',
      rating: (json['rating'] is num) ? (json['rating'] as num).toDouble() : 4.9,
      reviewsCount: json['reviews_count'] ?? 12,
    );
  }
}
