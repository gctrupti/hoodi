import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme/app_theme.dart';

class CreateRequestSheet extends StatefulWidget {
  const CreateRequestSheet({super.key});

  @override
  State<CreateRequestSheet> createState() => _CreateRequestSheetState();
}

class _CreateRequestSheetState extends State<CreateRequestSheet> {
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _addressController = TextEditingController(text: 'Indiranagar 100ft Road, Bengaluru');

  String _selectedCategory = 'errand';
  String _selectedUrgency = 'normal';
  double _fareAmount = 200.0;
  bool _isSubmitting = false;
  String? _errorMessage;

  final List<Map<String, String>> _categories = [
    {'id': 'grocery', 'label': 'Grocery'},
    {'id': 'errand', 'label': 'Errand'},
    {'id': 'elderly_care', 'label': 'Elderly Care'},
    {'id': 'transportation', 'label': 'Transport'},
    {'id': 'first_aid', 'label': 'First Aid'},
    {'id': 'other', 'label': 'Other'},
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _submitRequest() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      setState(() => _errorMessage = 'Please provide a task title.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final supabase = Supabase.instance.client;
      final userId = supabase.auth.currentUser?.id;

      if (userId == null) {
        throw Exception('Please sign in to create a request.');
      }

      await supabase.from('help_requests').insert({
        'requester_id': userId,
        'title': title,
        'description': _descController.text.trim(),
        'category': _selectedCategory,
        'urgency': _selectedUrgency,
        'status': 'open',
        'is_paid': _selectedUrgency != 'emergency',
        'estimated_fare': _fareAmount,
        'address_text': _addressController.text.trim(),
        'location': 'SRID=4326;POINT(77.6020 12.9730)',
        'request_type': 'custom',
      });

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppTheme.success,
            content: Text('Help request posted to neighbors within 5 km!'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = e.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
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
                'Ask for Neighborhood Help',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              Text(
                'Broadcast an errand or task to helpers within 5 km.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 18),

              // Title
              Text('WHAT DO YOU NEED HELP WITH?', style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 6),
              TextField(
                controller: _titleController,
                decoration: const InputDecoration(
                  hintText: 'e.g. Urgent medicine pickup from pharmacy',
                ),
              ),
              const SizedBox(height: 14),

              // Category Selector
              Text('CATEGORY', style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _categories.map((cat) {
                  final isSelected = _selectedCategory == cat['id'];
                  return ChoiceChip(
                    label: Text(cat['label']!),
                    selected: isSelected,
                    selectedColor: AppTheme.primary,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : AppTheme.ink,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      fontSize: 12,
                    ),
                    onSelected: (selected) {
                      if (selected) setState(() => _selectedCategory = cat['id']!);
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 14),

              // Urgency Level
              Text('URGENCY', style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 6),
              Row(
                children: [
                  _UrgencyRadio(
                    label: 'Normal',
                    value: 'normal',
                    groupValue: _selectedUrgency,
                    color: AppTheme.normal,
                    onChanged: (v) => setState(() => _selectedUrgency = v!),
                  ),
                  const SizedBox(width: 8),
                  _UrgencyRadio(
                    label: 'Today',
                    value: 'today',
                    groupValue: _selectedUrgency,
                    color: AppTheme.today,
                    onChanged: (v) => setState(() => _selectedUrgency = v!),
                  ),
                  const SizedBox(width: 8),
                  _UrgencyRadio(
                    label: 'Emergency',
                    value: 'emergency',
                    groupValue: _selectedUrgency,
                    color: AppTheme.emergency,
                    onChanged: (v) => setState(() => _selectedUrgency = v!),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Pickup / Location Address
              Text('LOCATION / ADDRESS', style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 6),
              TextField(
                controller: _addressController,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.location_on_outlined, size: 20),
                ),
              ),
              const SizedBox(height: 14),

              // Offered Fare
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('OFFERED FARE', style: Theme.of(context).textTheme.labelMedium),
                  Text(
                    '₹${_fareAmount.toInt()}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: AppTheme.primary,
                    ),
                  ),
                ],
              ),
              Slider(
                value: _fareAmount,
                min: 50,
                max: 1000,
                divisions: 19,
                activeColor: AppTheme.primary,
                onChanged: (v) => setState(() => _fareAmount = v),
              ),

              if (_errorMessage != null) ...[
                const SizedBox(height: 8),
                Text(
                  _errorMessage!,
                  style: const TextStyle(color: AppTheme.emergency, fontSize: 13),
                ),
              ],

              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _isSubmitting ? null : _submitRequest,
                child: _isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Broadcast Request'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UrgencyRadio extends StatelessWidget {
  final String label;
  final String value;
  final String groupValue;
  final Color color;
  final ValueChanged<String?> onChanged;

  const _UrgencyRadio({
    required this.label,
    required this.value,
    required this.groupValue,
    required this.color,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isSelected = value == groupValue;
    return Expanded(
      child: GestureDetector(
        onTap: () => onChanged(value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? color.withValues(alpha: 0.15) : AppTheme.surfaceSubtle,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? color : AppTheme.border,
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected ? color : AppTheme.inkSoft,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                fontSize: 13,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
