import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme/app_theme.dart';
import '../../models/skill_offering.dart';
import '../../models/skill_exchange.dart';

class SkillsMarketplaceView extends StatefulWidget {
  const SkillsMarketplaceView({super.key});

  @override
  State<SkillsMarketplaceView> createState() => _SkillsMarketplaceViewState();
}

class _SkillsMarketplaceViewState extends State<SkillsMarketplaceView>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _selectedCategory = 'all';
  bool _isLoading = true;
  List<SkillOffering> _skills = [];
  List<SkillExchangeMatch> _matches = [];

  final List<String> _categories = ['all', 'Coding', 'Music', 'Fitness', 'Art', 'Cooking'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadSkills();
    _loadExchangeMatches();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadSkills() async {
    setState(() => _isLoading = true);
    try {
      final supabase = Supabase.instance.client;
      final response = await supabase
          .from('skill_offerings')
          .select('*, teacher_profiles(headline, user_id, is_verified_teacher, teaching_mode, languages)')
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

  void _loadExchangeMatches() {
    _matches = [
      SkillExchangeMatch(
        candidateId: 'u2',
        candidateName: 'Rahul Kumar',
        candidateHeadline: 'Guitarist & software enthusiast in Indiranagar',
        candidateLocation: 'Indiranagar (790m away)',
        formattedDistance: '790m away',
        theyOffer: ['Classical Guitar', 'Fingerpicking', 'Music Theory'],
        theyWant: ['React', 'TypeScript', 'Web Development'],
        matchingOffer: 'Classical Guitar',
        matchingWant: 'React & Web Dev',
        matchScore: 98,
        isTwoWaySwap: true,
        matchReason: 'Direct 2-Way Swap: You teach React ⇄ Rahul teaches Guitar',
        preferredMode: 'both',
      ),
      SkillExchangeMatch(
        candidateId: 'u3',
        candidateName: 'Meera Nambiar',
        candidateHeadline: 'Yoga instructor & wellness mentor in Defence Colony',
        candidateLocation: 'Defence Colony (1.2 km away)',
        formattedDistance: '1.2 km',
        theyOffer: ['Hatha Yoga', 'Pranayama', 'Meditation'],
        theyWant: ['Frontend Coding', 'Portfolio Design'],
        matchingOffer: 'Hatha Yoga',
        matchingWant: 'Frontend Coding',
        matchScore: 92,
        isTwoWaySwap: true,
        matchReason: 'Direct 2-Way Swap: You teach Coding ⇄ Meera teaches Yoga',
        preferredMode: 'both',
      ),
      SkillExchangeMatch(
        candidateId: 'u4',
        candidateName: 'Chef Sridhar',
        candidateHeadline: 'South Indian cuisine artisan & baker',
        candidateLocation: 'Domlur (2.4 km away)',
        formattedDistance: '2.4 km',
        theyOffer: ['Sourdough & Dosa Fermentation', 'Filter Coffee Roasting'],
        theyWant: ['Basic Python', 'Excel Automation'],
        matchingOffer: 'Artisan Cooking',
        matchingWant: 'Basic Python',
        matchScore: 84,
        isTwoWaySwap: false,
        matchReason: 'They offer culinary skills you might love',
        preferredMode: 'offline',
      ),
    ];
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
        isVerified: true,
        teachingMode: 'both',
        languages: ['English', 'Kannada', 'Hindi'],
        durationMinutes: 60,
        portfolioSamples: ['Live Acoustic Album', 'Fingerstyle Medley 2024'],
        certifications: ['Trinity Guildhall Grade 6 Guitar'],
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
        isVerified: true,
        teachingMode: 'online',
        languages: ['English', 'Hindi'],
        durationMinutes: 90,
        portfolioSamples: ['Hoodi Open-Source Contributor', 'React Micro-Frontend Boilerplate'],
        certifications: ['AWS Certified Solutions Architect'],
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
        isVerified: true,
        teachingMode: 'both',
        languages: ['English', 'Malayalam'],
        durationMinutes: 60,
        portfolioSamples: ['Morning Asana Routine 2024'],
        certifications: ['Yoga Alliance 200hr RYT'],
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
        isVerified: false,
        teachingMode: 'offline',
        languages: ['English', 'Tamil', 'Kannada'],
        durationMinutes: 60,
        portfolioSamples: ['Wild Ferment Starter Guide'],
        certifications: ['Culinary Arts Diploma Bangalore'],
      ),
    ];
  }

  void _bookSession(SkillOffering skill) {
    final fare = skill.hourlyRate;
    final commission = (fare * 0.15).toInt();
    final teacherNet = (fare * 0.85).toInt();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    skill.title,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            Row(
              children: [
                Text('Instructor: ${skill.teacherName}', style: const TextStyle(fontSize: 13, color: AppTheme.inkSoft)),
                if (skill.isVerified) ...[
                  const SizedBox(width: 4),
                  const Icon(Icons.check_circle, size: 14, color: AppTheme.primary),
                ],
              ],
            ),
            const SizedBox(height: 12),

            // Teaching mode & language badges
            Wrap(
              spacing: 6,
              children: [
                Chip(
                  label: Text('Mode: ${skill.teachingMode}', style: const TextStyle(fontSize: 11)),
                  backgroundColor: AppTheme.surfaceSubtle,
                ),
                Chip(
                  label: Text(skill.languages.join(', '), style: const TextStyle(fontSize: 11)),
                  backgroundColor: AppTheme.surfaceSubtle,
                ),
              ],
            ),
            const SizedBox(height: 12),

            const Text('Select an available time slot:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('Tomorrow 6:00 PM'),
                  selected: true,
                  selectedColor: AppTheme.primary.withValues(alpha: 0.15),
                  onSelected: (_) {},
                ),
                ChoiceChip(
                  label: const Text('Thursday 7:30 PM'),
                  selected: false,
                  onSelected: (_) {},
                ),
                ChoiceChip(
                  label: const Text('Saturday 11:00 AM'),
                  selected: false,
                  onSelected: (_) {},
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Transparent pricing breakdown
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.2)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Session Fare', style: TextStyle(fontSize: 12, color: AppTheme.inkSoft)),
                      Text('₹${fare.toInt()}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Platform Fee (15%)', style: TextStyle(fontSize: 11, color: AppTheme.inkSoft)),
                      Text('- ₹$commission', style: const TextStyle(fontSize: 11, color: AppTheme.clay)),
                    ],
                  ),
                  const Divider(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Teacher Net Payout', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primary)),
                      Text('₹$teacherNet', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.primary)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Row(
              children: [
                Icon(Icons.shield, size: 14, color: AppTheme.primary),
                SizedBox(width: 4),
                Expanded(
                  child: Text(
                    'Funds held securely in Hoodi Escrow until session completion.',
                    style: TextStyle(fontSize: 11, color: AppTheme.inkSoft),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      backgroundColor: AppTheme.primary,
                      content: Text('Session booked with ${skill.teacherName}! Escrow hold secured.'),
                    ),
                  );
                },
                child: Text('Confirm & Hold ₹${fare.toInt()}'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showProposeSwapDialog(SkillExchangeMatch match) {
    final noteController = TextEditingController(
      text: "Hi ${match.candidateName}, I'd love to swap lessons! I can teach ${match.matchingWant} and learn ${match.matchingOffer}.",
    );

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.swap_calls, color: Colors.amber),
            const SizedBox(width: 8),
            Expanded(child: Text('Swap with ${match.candidateName}', style: const TextStyle(fontSize: 16))),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('✨ You Teach: ${match.matchingWant}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text('🎯 You Learn: ${match.matchingOffer}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.orange)),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text('Note & Proposed Times:', style: TextStyle(fontSize: 12, color: AppTheme.inkSoft)),
            const SizedBox(height: 4),
            TextField(
              controller: noteController,
              maxLines: 3,
              style: const TextStyle(fontSize: 12),
              decoration: InputDecoration(
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.all(10),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.amber[800]),
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  backgroundColor: Colors.amber[900],
                  content: Text('Swap proposal sent to ${match.candidateName}!'),
                ),
              );
            },
            child: const Text('Send Proposal', style: TextStyle(color: Colors.white)),
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
          children: const [
            Text('Hoodi Skills', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 19, color: AppTheme.ink)),
            Text('Learn, teach & barter peer-to-peer locally', style: TextStyle(fontSize: 11, color: AppTheme.inkSoft)),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.primary,
          labelColor: AppTheme.ink,
          unselectedLabelColor: AppTheme.inkSoft,
          tabs: const [
            Tab(text: 'Mentors & Lessons'),
            Tab(text: '🔥 Skill Exchange (Swap)'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // ================= TAB 1: MENTORS =================
          Column(
            children: [
              // Categories
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
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: isSelected ? AppTheme.ink : AppTheme.surface,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: isSelected ? AppTheme.ink : AppTheme.border),
                          ),
                          child: Text(
                            cat == 'all' ? 'All Skills' : cat,
                            style: TextStyle(
                              color: isSelected ? Colors.white : AppTheme.inkSoft,
                              fontSize: 12,
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
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: AppTheme.primary.withValues(alpha: 0.1),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              skill.category,
                                              style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 11),
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: AppTheme.surfaceSubtle,
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              skill.teachingMode,
                                              style: const TextStyle(fontSize: 10, color: AppTheme.inkSoft),
                                            ),
                                          ),
                                        ],
                                      ),
                                      Text(
                                        '₹${skill.hourlyRate.toInt()}/session',
                                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.primary),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    skill.title,
                                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.ink),
                                  ),
                                  if (skill.description != null) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      skill.description!,
                                      style: const TextStyle(fontSize: 12, color: AppTheme.inkSoft),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                  const SizedBox(height: 12),
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
                                            Row(
                                              children: [
                                                Text(
                                                  skill.teacherName,
                                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                                ),
                                                if (skill.isVerified) ...[
                                                  const SizedBox(width: 4),
                                                  const Icon(Icons.check_circle, size: 14, color: AppTheme.primary),
                                                ],
                                              ],
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
                                          const Icon(Icons.star, size: 15, color: Colors.amber),
                                          const SizedBox(width: 2),
                                          Text('${skill.rating}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                        ],
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  SizedBox(
                                    width: double.infinity,
                                    child: ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(vertical: 8),
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

          // ================= TAB 2: 🔥 SKILL EXCHANGE =================
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // User's own swap status
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.amber.withValues(alpha: 0.15), Colors.amber.withValues(alpha: 0.05)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.repeat, size: 16, color: Colors.amber),
                        SizedBox(width: 6),
                        Text('Your Peer Barter Profile', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text('✨ You Teach: React, TypeScript, Full-Stack Dev', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    const Text('🎯 You Want: Classical Guitar, Acoustic Fingerstyle', style: TextStyle(fontSize: 12, color: Colors.orange, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              const Text('Detected 2-Way Swaps Nearby:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 8),

              ..._matches.map((m) => Card(
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(
                    color: m.isTwoWaySwap ? Colors.amber.withValues(alpha: 0.5) : AppTheme.border,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: m.isTwoWaySwap ? Colors.amber : AppTheme.surfaceSubtle,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              m.isTwoWaySwap ? '★ ${m.matchScore}% Match · 2-Way Swap' : '${m.matchScore}% Match',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: m.isTwoWaySwap ? Colors.white : AppTheme.inkSoft,
                              ),
                            ),
                          ),
                          Text(m.candidateLocation, style: const TextStyle(fontSize: 11, color: AppTheme.inkSoft)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(m.candidateName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                      if (m.candidateHeadline != null)
                        Text(m.candidateHeadline!, style: const TextStyle(fontSize: 12, color: AppTheme.inkSoft)),
                      const SizedBox(height: 10),

                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceSubtle,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('They Teach: ${m.matchingOffer}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.primary)),
                            const SizedBox(height: 2),
                            Text('You Teach: ${m.matchingWant}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.orange)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),

                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.send, size: 14),
                          label: const Text('Propose Skill Swap'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.amber[800],
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 8),
                          ),
                          onPressed: () => _showProposeSwapDialog(m),
                        ),
                      ),
                    ],
                  ),
                ),
              )),
            ],
          ),
        ],
      ),
    );
  }
}
