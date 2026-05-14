import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'providers/order_provider.dart';
import 'providers/locale_provider.dart';
import 'screens/kiosk_screen.dart';
import 'screens/counter_screen.dart';
import 'services/api_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiService.initFromPrefs();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  Widget _resolveHome() {
    const mode = String.fromEnvironment('APP_MODE', defaultValue: '');
    if (mode == 'kiosk') return const KioskScreen();
    if (mode == 'counter') return const CounterScreen();

    if (kIsWeb) {
      final path = Uri.base.path.toLowerCase();
      if (path == '/kiosk' || path.startsWith('/kiosk/')) return const KioskScreen();
      if (path == '/counter' || path.startsWith('/counter/')) return const CounterScreen();
    }

    return const HomeScreen();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => OrderProvider()),
        ChangeNotifierProvider(create: (_) => AppLocaleProvider()..load()),
      ],
      child: Consumer<AppLocaleProvider>(
        builder: (context, localeProvider, _) {
          return MaterialApp(
            title: 'Meeting Room Services',
            theme: ThemeData(
              colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
              useMaterial3: true,
            ),
            locale: localeProvider.locale,
            home: _resolveHome(),
          );
        },
      ),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Meeting Room System'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const KioskScreen()),
                );
              },
              child: const Text('Ordering Kiosk'),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const CounterScreen()),
                );
              },
              child: const Text('Service Counter'),
            ),
          ],
        ),
      ),
    );
  }
}
