import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme/app_theme.dart';
import '../../models/service_listing.dart';

class ServicesMarketplaceView extends StatefulWidget {
  const ServicesMarketplaceView({super.key});

  @override
  State<ServicesMarketplaceView> createState() => _ServicesMarketplaceViewState();
}

class _ServicesMarketplaceViewState extends State<ServicesMarketplaceView>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _selectedCategory = 'all';
  int _selectedRadius = 10;
  bool _isLoading = true;
  String _searchQuery = '';
  List<ServiceListingModel> _services = [];

  final List<String> _categories = [
    'all',
    'Home Services',
    'Personal Services',
    'Professional Services',
    'Event Services',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadServices();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadServices() async {
    setState(() => _isLoading = true);
    try {
      final supabase = Supabase.instance.client;
      final response = await supabase
          .from('service_listings')
          .select('*, category:service_categories(name, slug), provider:service_provider_profiles(user_id, business_name, rating, completed_jobs_count, is_verified_provider)')
          .eq('is_active', true)
          .limit(20);

      final List<dynamic> data = response as List<dynamic>;
      final items = data.map((json) => ServiceListingModel.fromJson(json)).toList();

      if (items.isEmpty) {
        _services = _getMockServices();
      } else {
        _services = items;
      }
    } catch (e) {
      _services = _getMockServices();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<ServiceListingModel> _getMockServices() {
    return [
      ServiceListingModel(
        id: 'mock-1',
        providerId: 'prov-1',
        providerName: 'Suresh Electricals & Home Services',
        isVerifiedProvider: true,
        providerRating: 4.95,
        title: 'Emergency Switchboard & MCB Tripping Fix',
        description: 'Urgent diagnostic and repair for short circuits, sparking switchboards, and tripping MCBs.',
        categoryName: 'Home Services',
        pricingType: 'starting_from',
        basePrice: 349.0,
        estimatedDurationMins: 45,
        serviceRadiusKm: 15.0,
        distanceKm: 1.2,
        completedJobs: 28,
      ),
      ServiceListingModel(
        id: 'mock-2',
        providerId: 'prov-1',
        providerName: 'Suresh Electricals & Home Services',
        isVerifiedProvider: true,
        providerRating: 4.95,
        title: 'Comprehensive AC Deep Clean & Gas Check',
        description: 'Thorough high-pressure foam wash, filter cleaning, cooling coil scrub and refrigerant leak test.',
        categoryName: 'Home Services',
        pricingType: 'fixed',
        basePrice: 699.0,
        estimatedDurationMins: 60,
        serviceRadiusKm: 12.0,
        distanceKm: 1.2,
        completedJobs: 32,
      ),
      ServiceListingModel(
        id: 'mock-3',
        providerId: 'prov-2',
        providerName: 'Priya Yoga & Wellness',
        isVerifiedProvider: true,
        providerRating: 5.0,
        title: 'Personalized Hatha Yoga & Posture Training',
        description: '1-on-1 home yoga session focusing on back relief, flexibility, and breathing exercises.',
        categoryName: 'Personal Services',
        pricingType: 'hourly',
        basePrice: 600.0,
        estimatedDurationMins: 60,
        serviceRadiusKm: 8.0,
        distanceKm: 2.5,
        completedJobs: 19,
      ),
    ];
  }

  List<ServiceListingModel> get _filteredServices {
    return _services.where((s) {
      final matchesCat = _selectedCategory == 'all' ||
          s.categoryName.toLowerCase().contains(_selectedCategory.toLowerCase());
      final matchesSearch = _searchQuery.isEmpty ||
          s.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          s.providerName.toLowerCase().contains(_searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    }).toList();
  }

  void _showBookingSheet(ServiceListingModel service) {
    final dateController = TextEditingController(text: 'Tomorrow (Morning)');
    final addressController = TextEditingController();
    final notesController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          top: 24,
          left: 20,
          right: 20,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppTheme.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Request Service',
                style: Theme.of(ctx).textTheme.headlineMedium?.copyWith(fontSize: 20),
              ),
              const SizedBox(height: 4),
              Text(
                service.title,
                style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.ink),
              ),
              const SizedBox(height: 2),
              Text(
                'By ${service.providerName} • ₹${service.basePrice.toStringAsFixed(0)}',
                style: const TextStyle(fontSize: 12, color: AppTheme.inkSoft),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: dateController,
                decoration: InputDecoration(
                  labelText: 'Preferred Schedule',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                  prefixIcon: const Icon(Icons.calendar_today, size: 18),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: addressController,
                decoration: InputDecoration(
                  labelText: 'Service Location / Address',
                  hintText: 'e.g. Indiranagar 12th Main, Flat 302',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                  prefixIcon: const Icon(Icons.location_on_outlined, size: 18),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notesController,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Task Description / Instructions',
                  hintText: 'Describe what needs inspection or repair...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        backgroundColor: AppTheme.success,
                        content: Text('Request sent to ${service.providerName}!'),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.ink,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text('Submit Request', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Text(
              'Hoodi Services',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: AppTheme.ink),
            ),
            Text(
              'Hyperlocal professional & local experts',
              style: TextStyle(fontSize: 11, color: AppTheme.inkSoft),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.primary,
          unselectedLabelColor: AppTheme.inkSoft,
          indicatorColor: AppTheme.primary,
          indicatorWeight: 3,
          tabs: const [
            Tab(text: 'Explore Services'),
            Tab(text: 'Provider Mode'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // 1. Explore Services View
          RefreshIndicator(
            onRefresh: _loadServices,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Search Bar
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: TextField(
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: const InputDecoration(
                      hintText: "Search 'AC repair', 'Electrician'...",
                      border: InputBorder.none,
                      icon: Icon(Icons.search, color: AppTheme.inkSoft, size: 20),
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Radius Selector Row
                Row(
                  children: [
                    const Icon(Icons.near_me, size: 16, color: AppTheme.primary),
                    const SizedBox(width: 4),
                    const Text('Distance:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.inkSoft)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [1, 2, 5, 10, 20].map((r) {
                            final isSel = _selectedRadius == r;
                            return Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: ChoiceChip(
                                label: Text('$r km', style: TextStyle(fontSize: 11, color: isSel ? Colors.white : AppTheme.ink)),
                                selected: isSel,
                                selectedColor: AppTheme.ink,
                                backgroundColor: Colors.white,
                                onSelected: (_) => setState(() => _selectedRadius = r),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Category Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _categories.map((cat) {
                      final isSel = _selectedCategory == cat;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(
                            cat == 'all' ? 'All Services' : cat,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                              color: isSel ? Colors.white : AppTheme.ink,
                            ),
                          ),
                          selected: isSel,
                          selectedColor: AppTheme.primary,
                          backgroundColor: Colors.white,
                          onSelected: (_) => setState(() => _selectedCategory = cat),
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 16),

                // Service Cards
                if (_isLoading)
                  const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
                else if (_filteredServices.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(32),
                    alignment: Alignment.center,
                    child: Column(
                      children: const [
                        Icon(Icons.build_outlined, size: 48, color: AppTheme.inkMuted),
                        SizedBox(height: 12),
                        Text('No services found nearby', style: TextStyle(fontWeight: FontWeight.bold)),
                        SizedBox(height: 4),
                        Text('Try expanding your distance radius.', style: TextStyle(fontSize: 12, color: AppTheme.inkSoft)),
                      ],
                    ),
                  )
                else
                  ..._filteredServices.map((service) => Card(
                        margin: const EdgeInsets.only(bottom: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                        elevation: 0,
                        color: Colors.white,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppTheme.surfaceSubtle,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      service.categoryName,
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.inkSoft),
                                    ),
                                  ),
                                  Row(
                                    children: [
                                      const Icon(Icons.star, size: 16, color: Colors.amber),
                                      const SizedBox(width: 2),
                                      Text(
                                        service.providerRating.toStringAsFixed(1),
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                service.title,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.ink),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                service.description,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 12, color: AppTheme.inkSoft),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  const Icon(Icons.person_pin, size: 16, color: AppTheme.primary),
                                  const SizedBox(width: 4),
                                  Text(
                                    service.providerName,
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                  ),
                                  if (service.isVerifiedProvider) ...[
                                    const SizedBox(width: 4),
                                    const Icon(Icons.verified, size: 14, color: AppTheme.success),
                                  ],
                                  const Spacer(),
                                  if (service.distanceKm != null)
                                    Text(
                                      '${service.distanceKm!.toStringAsFixed(1)} km away',
                                      style: const TextStyle(fontSize: 11, color: AppTheme.inkMuted),
                                    ),
                                ],
                              ),
                              const Divider(height: 24),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        service.pricingType == 'fixed' ? 'Fixed Price' : 'Starting From',
                                        style: const TextStyle(fontSize: 10, color: AppTheme.inkMuted),
                                      ),
                                      Text(
                                        '₹${service.basePrice.toStringAsFixed(0)}',
                                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink),
                                      ),
                                    ],
                                  ),
                                  ElevatedButton(
                                    onPressed: () => _showBookingSheet(service),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppTheme.ink,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                    ),
                                    child: const Text('Book', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      )),
              ],
            ),
          ),

          // 2. Provider Mode View
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: AppTheme.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text('Provider Overview', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        Icon(Icons.badge_outlined, color: AppTheme.primary),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildMetricCol('48', 'Jobs Done'),
                        _buildMetricCol('⭐ 4.95', 'Rating'),
                        _buildMetricCol('₹14,250', 'Net Earnings'),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const Text('Incoming Requests', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 10),
              Card(
                color: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Switchboard Sparking Fix', style: TextStyle(fontWeight: FontWeight.bold)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: Colors.amber.shade100, borderRadius: BorderRadius.circular(8)),
                            child: const Text('Needs Quote', style: TextStyle(fontSize: 10, color: Colors.amber, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text('Priya Sharma • Indiranagar 12th Main', style: TextStyle(fontSize: 12, color: AppTheme.inkSoft)),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          ElevatedButton.icon(
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Quote builder opened.')),
                              );
                            },
                            icon: const Icon(Icons.receipt_outlined, size: 16, color: Colors.white),
                            label: const Text('Send Quote', style: TextStyle(color: Colors.white, fontSize: 12)),
                            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.ink),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCol(String value, String label) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.ink)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.inkSoft)),
      ],
    );
  }
}
