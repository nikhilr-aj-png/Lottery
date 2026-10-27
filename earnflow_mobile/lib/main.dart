import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Set system bar styling to match dark-gold platform theme
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Color(0xFF0B0E14),
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: Color(0xFF0B0E14),
      systemNavigationBarIconBrightness: Brightness.light,
      systemNavigationBarDividerColor: Colors.transparent,
    ),
  );

  runApp(const EarnFlowApp());
}

class EarnFlowApp extends StatelessWidget {
  const EarnFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EarnFlow USDT',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0B0E14),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFFD700),
          secondary: Color(0xFFF5C451),
          surface: Color(0xFF10131A),
        ),
        useMaterial3: true,
      ),
      home: const MainWebScreen(),
    );
  }
}

class MainWebScreen extends StatefulWidget {
  const MainWebScreen({super.key});

  @override
  State<MainWebScreen> createState() => _MainWebScreenState();
}

class _MainWebScreenState extends State<MainWebScreen> {
  static const String appUrl = 'https://earnflow.in';
  late final WebViewController _controller;
  
  bool _isLoading = true;
  double _loadingProgress = 0.0;
  bool _isOffline = false;
  DateTime? _lastBackPressTime;

  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;

  @override
  void initState() {
    super.initState();
    _initConnectivity();
    _initWebView();
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    super.dispose();
  }

  Future<void> _initConnectivity() async {
    final connectivity = Connectivity();
    final results = await connectivity.checkConnectivity();
    _updateConnectionStatus(results);

    _connectivitySubscription = connectivity.onConnectivityChanged.listen((results) {
      _updateConnectionStatus(results);
    });
  }

  void _updateConnectionStatus(List<ConnectivityResult> results) {
    final isNone = results.contains(ConnectivityResult.none) && results.length == 1;
    if (isNone != _isOffline) {
      setState(() {
        _isOffline = isNone;
      });
      if (!_isOffline) {
        _controller.reload();
      }
    }
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0B0E14))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            setState(() {
              _loadingProgress = progress / 100.0;
              if (progress >= 100) {
                _isLoading = false;
              }
            });
          },
          onPageStarted: (String url) {
            setState(() {
              _isLoading = true;
            });
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
            });
          },
          onWebResourceError: (WebResourceError error) {
            // Only flag offline if main frame fails
            if (error.isForMainFrame ?? false) {
              setState(() {
                _isOffline = true;
                _isLoading = false;
              });
            }
          },
          onNavigationRequest: (NavigationRequest request) async {
            final uri = Uri.parse(request.url);

            // Handle external deep links and schemes
            if (uri.scheme == 'whatsapp' ||
                uri.scheme == 'tg' ||
                uri.scheme == 'mailto' ||
                uri.scheme == 'tel' ||
                uri.host.contains('wa.me') ||
                uri.host.contains('t.me') ||
                uri.host.contains('tronscan.org')) {
              try {
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              } catch (_) {}
              return NavigationDecision.prevent;
            }

            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(appUrl));
  }

  Future<void> _handleRefresh() async {
    setState(() {
      _isOffline = false;
    });
    await _controller.reload();
  }

  void _showExitToast() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Row(
          children: [
            Icon(Icons.info_outline, color: Color(0xFFFFD700), size: 18),
            SizedBox(width: 8),
            Text(
              'Press back again to exit EarnFlow USDT',
              style: TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF141924),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Color(0x33FFD700)),
        ),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;

        if (await _controller.canGoBack()) {
          await _controller.goBack();
          return;
        }

        final now = DateTime.now();
        if (_lastBackPressTime == null ||
            now.difference(_lastBackPressTime!) > const Duration(seconds: 2)) {
          _lastBackPressTime = now;
          _showExitToast();
          return;
        }

        // Double back pressed within 2 seconds: close app
        SystemNavigator.pop();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0E14),
        body: SafeArea(
          bottom: false,
          child: Stack(
            children: [
              // Offline fallback screen or WebView
              if (_isOffline)
                _buildOfflineScreen()
              else
                RefreshIndicator(
                  color: const Color(0xFFFFD700),
                  backgroundColor: const Color(0xFF141924),
                  onRefresh: _handleRefresh,
                  child: WebViewWidget(controller: _controller),
                ),

              // Top progress bar during page load
              if (_isLoading && !_isOffline)
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: LinearProgressIndicator(
                    value: _loadingProgress > 0 ? _loadingProgress : null,
                    backgroundColor: Colors.transparent,
                    valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFFFD700)),
                    minHeight: 2.5,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOfflineScreen() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: const Color(0xFF141924),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0x33FFD700), width: 1.5),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x22FFD700),
                    blurRadius: 20,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: const Icon(
                Icons.wifi_off_rounded,
                size: 38,
                color: Color(0xFFFFD700),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'No Internet Connection',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Please check your Wi-Fi or mobile data network to access EarnFlow live lottery pools and wallet.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Color(0xFF9B8F7C),
                fontSize: 13,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 28),
            ElevatedButton.icon(
              onPressed: _handleRefresh,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text(
                'Retry Connection',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                foregroundColor: const Color(0xFF0B0E14),
                backgroundColor: const Color(0xFFFFD700),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
