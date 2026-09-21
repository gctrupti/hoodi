import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme/app_theme.dart';
import '../../models/skill_offering.dart';

class SkillsMarketplaceView extends StatefulWidget {
  const SkillsMarketplaceView({super.key});

  @override
  State<SkillsMarketplaceView> createState() => _SkillsMarketplaceViewState();
}

class _SkillsMarketplaceViewState extends State<SkillsMarketplaceView> {
  String _selectedCategory = 'all';
  bool _isLoading = true;
  List<SkillOffering> _skills = [];

  final List<String> _categories = ['all', 'Coding', 'Music', 'Fitness', 'Art', 'Cooking'];

  @override
  void initState() {
    super.initState();
    _loadSkills();
  }

  Future<void> _loadSkills() async {
    setState(() => _isLoading = true);
    try {
      final supabase = Supabase.instance.client;
      final response = await supabase
          .from('skill_offerings')
          .select('*, teacher_profiles(headline, user_id)')
          .limit(20);

      final List<dynamic> data = response as List<dynamic>;
      final items = data.map((json) => SkillOffering.fromJson(json)).toList();

      if (items.isEmpty) {
        _skills = _getMockSkills();
      } else {
        _skills = items;
      }
    } catch (e) {
      _skills = _getMockSkills();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<SkillOffering> _getMockSkills() {
    return [
      SkillOffering(
        id: 's1',
        title: 'Beginner Classical Guitar & Fingerstyle',
        description: 'Learn basic chords, scales, and fingerpicking patterns in 4 weeks. In-person or hybrid.',
        category: 'Music',
        hourlyRate: 600.0,
        level: 'Beginner',
        teacherName: 'Ravi Kumar',
        teacherHeadline: 'Guitarist & software engineer in Indiranagar',
        rating: 4.9,
        reviewsCount: 18,
      ),
      SkillOffering(
        id: 's2',
        title: 'Full-Stack Web Dev & Python Crash Course',
        description: 'Hands-on practical coding lessons. Build your own web app from scratch.',
        category: 'Coding',
        hourlyRate: 850.0,
        level: 'Intermediate',
        teacherName: 'Ravi Kumar',
        teacherHeadline: 'Senior dev with 6+ years experience',
        rating: 5.0,
        reviewsCount: 24,
      ),
      SkillOffering(
        id: 's3',
        title: 'Hatha Yoga & Breathwork Morning Sessions',
        description: 'Gentle morning yoga sessions for flexibility, posture, and stress relief.',
        category: 'Fitness',
        hourlyRate: 450.0,
        level: 'All Levels',
        teacherName: 'Meera Nambiar',
        teacherHeadline: 'Certified Yoga Instructor in Defence Colony',
        rating: 4.8,
        reviewsCount: 31,
      ),
      SkillOffering(
        id: 's4',
        title: 'Traditional South Indian Sourdough & Dosas',
        description: 'Master fermenting perfect batter and restaurant-quality crispy dosas at home.',
        category: 'Cooking',
        hourlyRate: 400.0,
        level: 'Beginner',
        teacherName: 'Chef Sridhar',
        teacherHeadline: 'Home chef & culinary enthusiast',
        rating: 4.9,
        reviewsCount: 15,
      ),
    ];
  }

  void _bookSession(SkillOffering skill) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Book Lesson: ${skill.title}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Instructor: ${skill.teacherName}'),
            const SizedBox(height: 6),
            Text('Hourly Rate: ₹${skill.hourlyRate.toInt()}/hour', style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            const Text(
              'Select an available slot for this week:',
              style: TextStyle(fontSize: 13, color: AppTheme.inkSoft),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                Chip(
                  label: const Text('Tomorrow 6:00 PM', style: TextStyle(fontSize: 12)),
                  backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                ),
                Chip(
                  label: const Text('Thursday 7:30 PM', style: TextStyle(fontSize: 12)),
                  backgroundColor: AppTheme.surfaceSubtle,
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  backgroundColor: AppTheme.success,
                  content: Text('Lesson booked with ${skill.teacherName}! Notification sent.'),
                ),
              );
            },
            child: const Text('Confirm Booking'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _selectedCategory == 'all'
        ? _skills
        : _skills.where((s) => s.category.toLowerCase() == _selectedCategory.toLowerCase()).toList();

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Hoodi Skills',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: AppTheme.ink),
            ),
            const Text(
              'Learn & teach peer-to-peer in your area',
              style: TextStyle(fontSize: 12, color: AppTheme.inkSoft),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: _categories.map((cat) {
                final isSelected = _selectedCategory == cat;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedCategory = cat),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? AppTheme.ink : AppTheme.surface,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: isSelected ? AppTheme.ink : AppTheme.border),
                      ),
                      child: Text(
                        cat == 'all' ? 'All Skills' : cat,
                        style: TextStyle(
                          color: isSelected ? Colors.white : AppTheme.inkSoft,
                          fontSize: 13,
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          // Skills List
          Expanded(
            child: _isLoading
              ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final skill = filtered[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 14),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: AppTheme.primary.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    skill.category,
                                    style: const TextStyle(
                                      color: AppTheme.primary,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 11,
                                    ),
                                  ),
                                ),
                                Text(
                                  '₹${skill.hourlyRate.toInt()}/hr',
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: AppTheme.primary,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              skill.title,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.ink,
                              ),
                            ),
                            if (skill.description != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                skill.description!,
                                style: const TextStyle(fontSize: 13, color: AppTheme.inkSoft),
                              ),
                            ],
                            const SizedBox(height: 14),
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 14,
                                  backgroundColor: AppTheme.primary.withValues(alpha: 0.2),
                                  child: Text(
                                    skill.teacherName.isNotEmpty ? skill.teacherName[0] : 'T',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.primary),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        skill.teacherName,
                                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                      ),
                                      if (skill.teacherHeadline != null)
                                        Text(
                                          skill.teacherHeadline!,
                                          style: const TextStyle(fontSize: 11, color: AppTheme.inkMuted),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                    ],
                                  ),
                                ),
                                Row(
                                  children: [
                                    const Icon(Icons.star, size: 16, color: Colors.amber),
                                    const SizedBox(width: 2),
                                    Text(
                                      '${skill.rating}',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                ),
                                onPressed: () => _bookSession(skill),
                                child: const Text('Book Lesson'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
          ),
        ],
      ),
    );
  }
}
