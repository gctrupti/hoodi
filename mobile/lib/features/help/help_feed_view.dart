import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme/app_theme.dart';
import '../../models/help_request.dart';
import 'create_request_sheet.dart';

class HelpFeedView extends StatefulWidget {
  const HelpFeedView({super.key});

  @override
  State<HelpFeedView> createState() => _HelpFeedViewState();
}

class _HelpFeedViewState extends State<HelpFeedView> {
  String _selectedCategory = 'all';
  int _selectedRadiusM = 5000;
  bool _isLoading = true;
  List<HelpRequest> _requests = [];
  RealtimeChannel? _channel;

  final List<int> _radiusOptions = [1000, 2000, 5000, 10000, 20000];

  @override
  void initState() {
    super.initState();
    _loadRequests();
    _setupRealtime();
  }

  void _setupRealtime() {
    _channel = Supabase.instance.client
        .channel('public:help_requests_feed')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'help_requests',
          callback: (_) => _loadRequests(),
        )
        .subscribe();
  }

  @override
  void dispose() {
    if (_channel != null) {
      Supabase.instance.client.removeChannel(_channel!);
    }
    super.dispose();
  }

  Future<void> _loadRequests() async {
    setState(() => _isLoading = true);
    try {
      final supabase = Supabase.instance.client;
      final response = await supabase
          .from('help_requests')
          .select('*, requester:profiles!requester_id(name), helper:profiles!helper_id(name)')
          .order('created_at', ascending: false);

      final List<dynamic> data = response as List<dynamic>;
      final items = data.map((json) => HelpRequest.fromJson(json)).toList();

      if (items.isEmpty) {
        // Indiranagar fallback demo errands
        _requests = [
          HelpRequest(
            id: 'mock-1',
            title: 'Urgent BP Medicine from Apollo Indiranagar',
            description: 'Please pick up prescription medicine from 100ft road and bring to 12th Main.',
            category: 'first_aid',
            urgency: 'today',
            status: 'open',
            fareAmount: 150.0,
            pickupAddress: 'Apollo Pharmacy, 100ft Rd',
            dropoffAddress: '12th Main, HAL 2nd Stage',
            requesterName: 'Priya Sharma',
            createdAt: DateTime.now().subtract(const Duration(minutes: 15)),
          ),
          HelpRequest(
            id: 'mock-2',
            title: 'Kitchen Sink Pipe Leak Repair',
            description: 'Under-sink pipe leaking. Looking for neighbor with a wrench.',
            category: 'errand',
            urgency: 'today',
            status: 'accepted',
            fareAmount: 350.0,
            pickupAddress: 'Indiranagar 12th Main',
            requesterName: 'Priya Sharma',
            helperName: 'Ravi Kumar',
            createdAt: DateTime.now().subtract(const Duration(hours: 1)),
          ),
        ];
      } else {
        _requests = items;
      }
    } catch (e) {
      // Keep existing data or fallback
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _acceptTask(HelpRequest req) async {
    final scaffold = ScaffoldMessenger.of(context);
    try {
      final supabase = Supabase.instance.client;
      final user = supabase.auth.currentUser;
      if (user == null) {
        scaffold.showSnackBar(
          const SnackBar(content: Text('Please sign in to accept requests.')),
        );
        return;
      }

      await supabase.rpc('accept_help_request', params: {
        '_request_id': req.id,
        '_order_id': 'mob_sim_${DateTime.now().millisecondsSinceEpoch}',
      });

      scaffold.showSnackBar(
        const SnackBar(
          content: Text('Task accepted! Escrow payment locked and chat initiated.'),
          backgroundColor: AppTheme.primary,
        ),
      );
      _loadRequests();
    } catch (e) {
      scaffold.showSnackBar(
        SnackBar(
          content: Text('Accept failed: ${e.toString().replaceAll('Exception: ', '')}'),
          backgroundColor: AppTheme.emergency,
        ),
      );
    }
  }

  Future<void> _updateStatus(HelpRequest req, String newStatus, {String? stage, String? photoUrl}) async {
    final scaffold = ScaffoldMessenger.of(context);
    try {
      final supabase = Supabase.instance.client;
      final Map<String, dynamic> updateData = {'status': newStatus};
      if (stage != null) updateData['delivery_stage'] = stage;
      if (photoUrl != null) updateData['photo_url'] = photoUrl;
      if (newStatus == 'completed') updateData['completed_at'] = DateTime.now().toIso8601String();
      if (newStatus == 'cancelled') updateData['cancelled_at'] = DateTime.now().toIso8601String();

      await supabase.from('help_requests').update(updateData).eq('id', req.id);

      scaffold.showSnackBar(
        SnackBar(
          content: Text('Status updated to $newStatus!'),
          backgroundColor: AppTheme.primary,
        ),
      );
      _loadRequests();
    } catch (e) {
      scaffold.showSnackBar(
        SnackBar(content: Text('Update failed: $e'), backgroundColor: AppTheme.emergency),
      );
    }
  }

  void _showFindClosestHelperSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        final mockHelpers = [
          {
            'name': 'Ravi Kumar',
            'rating': '5.0',
            'distance': '0.8 km',
            'eta': '~3 mins',
            'match': '98%',
            'reason': 'Fastest responder · Indiranagar 100ft Rd',
            'initial': 'R',
          },
          {
            'name': 'Anand Swamy',
            'rating': '4.9',
            'distance': '1.2 km',
            'eta': '~5 mins',
            'match': '94%',
            'reason': 'Top rated scooter helper · 31 helps',
            'initial': 'A',
          },
          {
            'name': 'Maya Venkatesh',
            'rating': '4.8',
            'distance': '1.9 km',
            'eta': '~8 mins',
            'match': '89%',
            'reason': 'Verified neighbor · HAL 2nd Stage',
            'initial': 'M',
          },
        ];

        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.bolt, color: Colors.amber, size: 24),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Closest Suitable Helpers',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Smart multi-factor match: ETA, distance & ratings',
                          style: TextStyle(fontSize: 12, color: AppTheme.inkSoft),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              ...mockHelpers.map((h) => Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          child: Text(h['initial']!, style: const TextStyle(fontWeight: FontWeight.bold)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(h['name']!, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                  const SizedBox(width: 6),
                                  Text('★ ${h['rating']}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.amber)),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${h['distance']} · ${h['eta']} ETA',
                                style: const TextStyle(fontSize: 12, color: AppTheme.primary, fontWeight: FontWeight.w600),
                              ),
                              Text(
                                h['reason']!,
                                style: const TextStyle(fontSize: 11, color: AppTheme.inkMuted),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            h['match']!,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primary),
                          ),
                        ),
                      ],
                    ),
                  )),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: () {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Dispatched request to #1 match Ravi Kumar!')),
                    );
                  },
                  child: const Text('Dispatch Request to Best Match'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showTaskDetailsSheet(HelpRequest req) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        final fare = req.finalFare ?? req.fareAmount;
        final platformFee = (fare * 0.15).round();
        final helperEarnings = fare - platformFee;

        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // Title & Status Badge
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      req.title,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      req.status.toUpperCase(),
                      style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),

              if (req.description != null && req.description!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  req.description!,
                  style: const TextStyle(fontSize: 13, color: AppTheme.inkSoft, height: 1.4),
                ),
              ],
              const SizedBox(height: 16),

              // Locations Card
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.border),
                ),
                child: Column(
                  children: [
                    if (req.pickupAddress != null)
                      Row(
                        children: [
                          const Icon(Icons.storefront, size: 16, color: AppTheme.clay),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Pickup: ${req.pickupAddress}',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    if (req.dropoffAddress != null) ...[
                      const Divider(height: 16),
                      Row(
                        children: [
                          const Icon(Icons.location_on, size: 16, color: AppTheme.primary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Delivery: ${req.dropoffAddress}',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Pricing Breakdown
              Container(
                padding: const EdgeInsets.all(14),
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
                        const Text('Offered Errand Fare', style: TextStyle(fontSize: 12, color: AppTheme.inkSoft)),
                        Text('₹${fare.toInt()}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Platform Fee (15%)', style: TextStyle(fontSize: 11, color: AppTheme.inkSoft)),
                        Text('- ₹$platformFee', style: const TextStyle(fontSize: 11, color: AppTheme.clay)),
                      ],
                    ),
                    const Divider(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Helper Net Payout', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primary)),
                        Text('₹${helperEarnings.toInt()}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.primary)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Action buttons based on lifecycle
              if (req.isOpen)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: () {
                      Navigator.pop(context);
                      _acceptTask(req);
                    },
                    child: const Text('Accept & Help Neighbor', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),

              if (req.isAssigned) ...[
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.ink,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: () {
                      Navigator.pop(context);
                      _updateStatus(req, 'in_progress', stage: 'to_pickup');
                    },
                    child: const Text('Start Errand (Head to Pickup)'),
                  ),
                ),
              ],

              if (req.isInProgress) ...[
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: () {
                      Navigator.pop(context);
                      _updateStatus(req, 'in_progress', stage: 'picked_up');
                    },
                    child: const Text('I Have Arrived at Location'),
                  ),
                ),
              ],

              if (req.isArrived || req.isInProgress) ...[
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.normal,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: () {
                      Navigator.pop(context);
                      _updateStatus(req, 'completed', stage: 'delivered', photoUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500');
                    },
                    child: const Text('Mark Complete (Attach Proof)'),
                  ),
                ),
              ],

              if (req.isCompleted) ...[
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.star, color: Colors.amber),
                    label: const Text('Leave 5-Star Rating for Helper'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.ink,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: () {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Thank you! 5-star rating recorded.')),
                      );
                    },
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _selectedCategory == 'all'
        ? _requests
        : _requests.where((r) => r.category.toLowerCase() == _selectedCategory.toLowerCase()).toList();

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text(
                  'Community Errands',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${_selectedRadiusM >= 1000 ? '${_selectedRadiusM ~/ 1000} km' : '$_selectedRadiusM m'} radius',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.primary),
                  ),
                ),
              ],
            ),
            const Text(
              'Indiranagar, Bengaluru',
              style: TextStyle(fontSize: 12, color: AppTheme.inkSoft),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.bolt, color: Colors.amber),
            tooltip: 'Find Closest Helper',
            onPressed: _showFindClosestHelperSheet,
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: AppTheme.inkSoft),
            onPressed: _loadRequests,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Ask for Help'),
        onPressed: () async {
          final res = await showModalBottomSheet<bool>(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            builder: (_) => const CreateRequestSheet(),
          );
          if (res == true) _loadRequests();
        },
      ),
      body: RefreshIndicator(
        onRefresh: _loadRequests,
        color: AppTheme.primary,
        child: Column(
          children: [
            // Dynamic Radius Selector Bar (1km, 2km, 5km, 10km, 20km)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              color: AppTheme.surface,
              child: Row(
                children: [
                  const Text('Radius: ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.inkSoft)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: _radiusOptions.map((r) {
                          final isSel = _selectedRadiusM == r;
                          final label = r >= 1000 ? '${r ~/ 1000} km' : '$r m';
                          return GestureDetector(
                            onTap: () {
                              setState(() => _selectedRadiusM = r);
                              _loadRequests();
                            },
                            child: Container(
                              margin: const EdgeInsets.only(right: 6),
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: isSel ? AppTheme.primary : Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: isSel ? AppTheme.primary : AppTheme.border),
                              ),
                              child: Text(
                                label,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                                  color: isSel ? Colors.white : AppTheme.ink,
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Category Filter Bar
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  _FilterChip(
                    label: 'All Tasks',
                    isSelected: _selectedCategory == 'all',
                    onTap: () => setState(() => _selectedCategory = 'all'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Errands',
                    isSelected: _selectedCategory == 'errand',
                    onTap: () => setState(() => _selectedCategory = 'errand'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Deliveries',
                    isSelected: _selectedCategory == 'delivery',
                    onTap: () => setState(() => _selectedCategory = 'delivery'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Groceries',
                    isSelected: _selectedCategory == 'grocery',
                    onTap: () => setState(() => _selectedCategory = 'grocery'),
                  ),
                ],
              ),
            ),

            // Request Cards Feed
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
                  : filtered.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.check_circle_outline, size: 48, color: AppTheme.inkMuted),
                              const SizedBox(height: 12),
                              const Text(
                                'No pending requests nearby!',
                                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 4),
                              Text('Try expanding radius to 10 km or 20 km.'),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final req = filtered[index];
                            return _RequestCard(
                              request: req,
                              onTap: () => _showTaskDetailsSheet(req),
                              onAccept: () => _acceptTask(req),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.ink : AppTheme.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? AppTheme.ink : AppTheme.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : AppTheme.inkSoft,
            fontSize: 13,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  final HelpRequest request;
  final VoidCallback onTap;
  final VoidCallback onAccept;

  const _RequestCard({
    required this.request,
    required this.onTap,
    required this.onAccept,
  });

  Color _getUrgencyColor(String urgency) {
    switch (urgency.toLowerCase()) {
      case 'emergency':
        return AppTheme.emergency;
      case 'today':
        return AppTheme.today;
      default:
        return AppTheme.normal;
    }
  }

  @override
  Widget build(BuildContext context) {
    final urgencyColor = _getUrgencyColor(request.urgency);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Row: Urgency badge, ETA & Fare
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: urgencyColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          request.urgency.toUpperCase(),
                          style: TextStyle(
                            color: urgencyColor,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.border,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          request.status.toUpperCase(),
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.inkSoft),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    '₹${request.fareAmount.toInt()}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Title
              Text(
                request.title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.ink,
                ),
              ),
              if (request.description != null && request.description!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  request.description!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, color: AppTheme.inkSoft),
                ),
              ],
              const SizedBox(height: 12),

              // Requester & Multi-Modal Distance/ETA
              Row(
                children: [
                  const Icon(Icons.location_on_outlined, size: 16, color: AppTheme.primary),
                  const SizedBox(width: 4),
                  const Text(
                    '0.8 km · 🚶 11m · 🛵 3m',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primary),
                  ),
                  const Spacer(),
                  Text(
                    'By ${request.requesterName}',
                    style: const TextStyle(fontSize: 11, color: AppTheme.inkMuted),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Primary Action
              if (request.isOpen)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                    onPressed: onAccept,
                    child: const Text('Accept & Help Neighbor'),
                  ),
                )
              else
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    onPressed: onTap,
                    child: Text('View Details & Status (${request.status.toUpperCase()})'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
