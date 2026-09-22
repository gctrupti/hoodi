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
  final bool isVerified;
  final String teachingMode;
  final List<String> languages;
  final int durationMinutes;
  final List<String> portfolioSamples;
  final List<String> certifications;

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
    this.isVerified = false,
    this.teachingMode = 'both',
    this.languages = const ['English', 'Kannada'],
    this.durationMinutes = 60,
    this.portfolioSamples = const [],
    this.certifications = const [],
  });

  factory SkillOffering.fromJson(Map<String, dynamic> json) {
    final tp = (json['teacher_profiles'] is Map) ? json['teacher_profiles'] as Map<String, dynamic> : null;
    return SkillOffering(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? 'Skill Lesson',
      description: json['description'],
      category: json['category'] ?? 'General',
      hourlyRate: (json['price_per_session'] is num)
          ? (json['price_per_session'] as num).toDouble()
          : (json['hourly_rate'] is num)
              ? (json['hourly_rate'] as num).toDouble()
              : double.tryParse(json['hourly_rate']?.toString() ?? '500') ?? 500.0,
      level: json['level'] ?? 'All Levels',
      teacherName: json['teacher_name'] ?? 'Local Instructor',
      teacherHeadline: tp?['headline'] ?? json['headline'] ?? 'Experienced teacher in Bengaluru',
      rating: (json['rating'] is num) ? (json['rating'] as num).toDouble() : 4.9,
      reviewsCount: json['reviews_count'] ?? 12,
      isVerified: json['is_verified_teacher'] == true || tp?['is_verified_teacher'] == true,
      teachingMode: json['teaching_mode'] ?? tp?['teaching_mode'] ?? 'both',
      languages: (json['languages'] is List)
          ? List<String>.from(json['languages'])
          : (tp?['languages'] is List)
              ? List<String>.from(tp!['languages'])
              : const ['English', 'Kannada'],
      durationMinutes: json['duration_minutes'] is int ? json['duration_minutes'] : 60,
      portfolioSamples: (json['portfolio_samples'] is List)
          ? List<String>.from(json['portfolio_samples'])
          : const [],
      certifications: (json['certifications'] is List)
          ? List<String>.from(json['certifications'])
          : const [],
    );
  }
}
