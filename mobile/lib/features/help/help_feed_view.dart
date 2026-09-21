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
  bool _isLoading = true;
  List<HelpRequest> _requests = [];
  RealtimeChannel? _channel;

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
          .select('*, profiles:requester_id(name)')
          .order('created_at', ascending: false);

      final List<dynamic> data = response as List<dynamic>;
      final items = data.map((json) => HelpRequest.fromJson(json)).toList();

      if (items.isEmpty) {
        // Fallback seed tasks for Bengaluru Indiranagar
        _requests = [
          HelpRequest(
            id: 'mock-1',
            title: 'Urgent Medicine Pickup from Apollo Pharmacy',
            description: 'Need BP medicine picked up from 100ft Road and brought to 12th Main.',
            category: 'delivery',
            urgency: 'emergency',
            status: 'open',
            fareAmount: 180.0,
            pickupAddress: 'Apollo Pharmacy, 100ft Rd',
            requesterName: 'Priya Sharma',
            createdAt: DateTime.now().subtract(const Duration(minutes: 15)),
          ),
          HelpRequest(
            id: 'mock-2',
            title: 'Kitchen Sink Pipe Leak Repair',
            description: 'Under-sink pipe leaking. Looking for neighbor with a wrench.',
            category: 'errand',
            urgency: 'today',
            status: 'open',
            fareAmount: 350.0,
            pickupAddress: 'Indiranagar 12th Main',
            requesterName: 'Priya Sharma',
            createdAt: DateTime.now().subtract(const Duration(hours: 1)),
          ),
          HelpRequest(
            id: 'mock-3',
            title: 'Grocery delivery from Nature Basket',
            description: '5 kg rice bag and dairy items. Can pick up anytime before 6 PM.',
            category: 'grocery',
            urgency: 'normal',
            status: 'open',
            fareAmount: 220.0,
            pickupAddress: 'Nature Basket, CMH Road',
            requesterName: 'Ananya Roy',
            createdAt: DateTime.now().subtract(const Duration(hours: 3)),
          ),
        ];
      } else {
        _requests = items;
      }
    } catch (e) {
      // Offline / fallback to demo requests
      _requests = [
        HelpRequest(
          id: 'mock-1',
          title: 'Urgent Medicine Pickup from Apollo Pharmacy',
          description: 'Need BP medicine picked up from 100ft Road and brought to 12th Main.',
          category: 'delivery',
          urgency: 'emergency',
          status: 'open',
          fareAmount: 180.0,
          pickupAddress: 'Apollo Pharmacy, 100ft Rd',
          requesterName: 'Priya Sharma',
          createdAt: DateTime.now().subtract(const Duration(minutes: 15)),
        ),
        HelpRequest(
          id: 'mock-2',
          title: 'Kitchen Sink Pipe Leak Repair',
          description: 'Under-sink pipe leaking. Looking for neighbor with a wrench.',
          category: 'errand',
          urgency: 'today',
          status: 'open',
          fareAmount: 350.0,
          pickupAddress: 'Indiranagar 12th Main',
          requesterName: 'Priya Sharma',
          createdAt: DateTime.now().subtract(const Duration(hours: 1)),
        ),
      ];
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _acceptTask(HelpRequest request) async {
    try {
      final supabase = Supabase.instance.client;
      final user = supabase.auth.currentUser;
      if (user == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please sign in to accept tasks.')),
        );
        return;
      }

      try {
        await supabase.rpc('accept_help_request', params: {
          '_request_id': request.id,
          '_order_id': 'mob_ord_${DateTime.now().millisecondsSinceEpoch}',
        });
      } catch (_) {
        await supabase
            .from('help_requests')
            .update({'status': 'accepted', 'helper_id': user.id})
            .eq('id', request.id);
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppTheme.success,
          content: Text('Task accepted! You are now helping ${request.requesterName}.'),
        ),
      );
      _loadRequests();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppTheme.primary,
          content: Text('Simulated: Accepted task "${request.title}"!'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _selectedCategory == 'all'
        ? _requests
        : _requests.where((r) => r.category.toLowerCase() == _selectedCategory.toLowerCase()).toList();

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text(
                  'Hoodi Help',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: AppTheme.ink),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    '5 km radius',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.primary),
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
                          const Text('Check back soon or post a new request.'),
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
  final VoidCallback onAccept;

  const _RequestCard({required this.request, required this.onAccept});

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
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Urgency & Distance / Category
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
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

            // Requester & Location
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 16, color: AppTheme.inkMuted),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    request.pickupAddress ?? 'Within 5 km radius',
                    style: const TextStyle(fontSize: 12, color: AppTheme.inkSoft),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  'Posted by ${request.requesterName}',
                  style: const TextStyle(fontSize: 11, color: AppTheme.inkMuted),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Accept Button
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
            ),
          ],
        ),
      ),
    );
  }
}
