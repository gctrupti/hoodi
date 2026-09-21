import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/theme/app_theme.dart';
import '../auth/auth_screen.dart';

class WalletView extends StatefulWidget {
  const WalletView({super.key});

  @override
  State<WalletView> createState() => _WalletViewState();
}

class _WalletViewState extends State<WalletView> {
  double _balance = 1250.0;
  String _userEmail = '';

  @override
  void initState() {
    super.initState();
    _loadWallet();
  }

  Future<void> _loadWallet() async {
    final user = Supabase.instance.client.auth.currentUser;
    setState(() {
      _userEmail = user?.email ?? 'helper@hoodi.com';
    });
  }

  Future<void> _signOut() async {
    await Supabase.instance.client.auth.signOut();
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const AuthScreen()),
        (route) => false,
      );
    }
  }

  void _addFunds() {
    setState(() => _balance += 500);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: AppTheme.success,
        content: Text('₹500 added to your Hoodi wallet!'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        title: const Text(
          'Wallet & Trust',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: AppTheme.ink),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: AppTheme.emergency),
            tooltip: 'Sign out',
            onPressed: _signOut,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // User Header & Trust Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: AppTheme.primary.withValues(alpha: 0.15),
                      child: const Icon(Icons.person, color: AppTheme.primary, size: 28),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _userEmail,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppTheme.success.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Row(
                                  children: [
                                    Icon(Icons.verified, size: 12, color: AppTheme.success),
                                    SizedBox(width: 3),
                                    Text(
                                      'Verified Neighbor',
                                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.success),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Text('⭐ 4.9 rating', style: TextStyle(fontSize: 12, color: AppTheme.inkSoft)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Hoodi Balance Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.ink, Color(0xFF3F3B37)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(22),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.ink.withValues(alpha: 0.2),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'HOODI BALANCE',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.8,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Text(
                          'Simulation Active',
                          style: TextStyle(color: Colors.white, fontSize: 10),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '₹${_balance.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        ),
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Add Funds', style: TextStyle(fontSize: 12)),
                        onPressed: _addFunds,
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: const BorderSide(color: Colors.white30),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        ),
                        icon: const Icon(Icons.arrow_upward, size: 14),
                        label: const Text('Payout', style: TextStyle(fontSize: 12)),
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Payout requested to linked UPI ID.')),
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),

            // Transactions History
            Text('RECENT ACTIVITY', style: Theme.of(context).textTheme.labelMedium),
            const SizedBox(height: 10),
            _TransactionTile(
              title: 'Pharmacy Errand Completed',
              subtitle: 'From Priya Sharma • Indiranagar',
              amount: '+₹180.00',
              isPositive: true,
              date: 'Today, 11:20 AM',
            ),
            _TransactionTile(
              title: 'Platform Commission (15%)',
              subtitle: 'Hoodi Community Fee',
              amount: '-₹27.00',
              isPositive: false,
              date: 'Today, 11:20 AM',
            ),
            _TransactionTile(
              title: 'Guitar Lesson Booking Escrow',
              subtitle: 'Learner: Rahul Verma',
              amount: '+₹600.00',
              isPositive: true,
              date: 'Yesterday, 4:15 PM',
            ),
          ],
        ),
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final String amount;
  final bool isPositive;
  final String date;

  const _TransactionTile({
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.isPositive,
    required this.date,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: (isPositive ? AppTheme.success : AppTheme.inkSoft).withValues(alpha: 0.1),
          child: Icon(
            isPositive ? Icons.arrow_downward : Icons.arrow_upward,
            color: isPositive ? AppTheme.success : AppTheme.inkSoft,
            size: 18,
          ),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text('$subtitle • $date', style: const TextStyle(fontSize: 12)),
        trailing: Text(
          amount,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: isPositive ? AppTheme.success : AppTheme.ink,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}
