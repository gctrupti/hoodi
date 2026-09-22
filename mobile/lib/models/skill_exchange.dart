class SkillExchangeMatch {
  final String candidateId;
  final String candidateName;
  final String? candidatePhoto;
  final String? candidateHeadline;
  final String candidateLocation;
  final String? formattedDistance;
  final List<String> theyOffer;
  final List<String> theyWant;
  final String matchingOffer;
  final String matchingWant;
  final int matchScore;
  final bool isTwoWaySwap;
  final String matchReason;
  final String preferredMode;

  SkillExchangeMatch({
    required this.candidateId,
    required this.candidateName,
    this.candidatePhoto,
    this.candidateHeadline,
    required this.candidateLocation,
    this.formattedDistance,
    required this.theyOffer,
    required this.theyWant,
    required this.matchingOffer,
    required this.matchingWant,
    required this.matchScore,
    required this.isTwoWaySwap,
    required this.matchReason,
    this.preferredMode = 'both',
  });

  factory SkillExchangeMatch.fromJson(Map<String, dynamic> json) {
    return SkillExchangeMatch(
      candidateId: json['candidate_id'] ?? '',
      candidateName: json['candidate_name'] ?? 'Neighbor',
      candidatePhoto: json['candidate_photo'],
      candidateHeadline: json['candidate_headline'],
      candidateLocation: json['candidate_location'] ?? 'Bengaluru',
      formattedDistance: json['formatted_distance'],
      theyOffer: List<String>.from(json['they_offer'] ?? []),
      theyWant: List<String>.from(json['they_want'] ?? []),
      matchingOffer: json['matching_offer'] ?? '',
      matchingWant: json['matching_want'] ?? '',
      matchScore: (json['match_score'] is num) ? (json['match_score'] as num).toInt() : 85,
      isTwoWaySwap: json['is_two_way_swap'] ?? false,
      matchReason: json['match_reason'] ?? 'Community Skill Match',
      preferredMode: json['preferred_mode'] ?? 'both',
    );
  }
}

class SkillExchangeProposal {
  final String id;
  final String status;
  final String partnerName;
  final String youTeach;
  final String youLearn;
  final String mode;
  final String? notes;

  SkillExchangeProposal({
    required this.id,
    required this.status,
    required this.partnerName,
    required this.youTeach,
    required this.youLearn,
    required this.mode,
    this.notes,
  });
}
