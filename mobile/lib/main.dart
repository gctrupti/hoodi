import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/constants/supabase_constants.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/auth_screen.dart';
import 'features/home/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: SupabaseConstants.supabaseUrl,
    // ignore: deprecated_member_use
    anonKey: SupabaseConstants.supabaseAnonKey,
  );

  runApp(const HoodiApp());
}

class HoodiApp extends StatelessWidget {
  const HoodiApp({super.key});

  @override
  Widget build(BuildContext context) {
    final session = Supabase.instance.client.auth.currentSession;

    return MaterialApp(
      title: 'Hoodi — Hyperlocal Community',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: session != null ? const HomeScreen() : const AuthScreen(),
    );
  }
}
