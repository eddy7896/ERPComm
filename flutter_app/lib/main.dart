import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:ERPComm/screens/login_screen.dart';
import 'package:ERPComm/screens/home_screen.dart';
import 'package:ERPComm/theme/shad_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Supabase.initialize(
    url: 'https://rysxvlpvrqhxoqjnigoo.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5c3h2bHB2cnFoeG9xam5pZ29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MDA2MzksImV4cCI6MjA4MzQ3NjYzOX0.fvehQRdRhOssrbqPuLVUJ4C81zPWXRxgWnZ7ewPOxio',
  );

  runApp(
    const ProviderScope(
      child: MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ERPComm',
      debugShowCheckedModeBanner: false,
      theme: ShadTheme.lightTheme,
      home: const AuthWrapper(),
    );
  }
}

class AuthWrapper extends StatelessWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context) {
    final session = Supabase.instance.client.auth.currentSession;
    if (session != null) {
      return const HomeScreen();
    } else {
      return const LoginScreen();
    }
  }
}
