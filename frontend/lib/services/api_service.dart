import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/order.dart';
import 'http_client_factory.dart';

class ApiService {
  static const String _envBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: '');
  static const String _envSocketUrl = String.fromEnvironment('SOCKET_URL', defaultValue: '');
  static const String _prefsServerHostKey = 'server_host';
  static const String _prefsServerPortKey = 'server_port';
  static String? _runtimeServerHost;
  static int? _runtimeServerPort;

  static Future<void> initFromPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final host = (prefs.getString(_prefsServerHostKey) ?? '').trim();
      final port = prefs.getInt(_prefsServerPortKey);
      if (host.isNotEmpty && port != null) {
        _runtimeServerHost = host;
        _runtimeServerPort = port;
      }
    } catch (_) {}
  }

  static Future<void> saveServerToPrefs({required String host, required int port}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsServerHostKey, host);
    await prefs.setInt(_prefsServerPortKey, port);
    _runtimeServerHost = host;
    _runtimeServerPort = port;
  }

  static String _originFromHostPort(String host, int port) {
    final scheme = port == 443 ? 'https' : 'http';
    return '$scheme://$host:$port';
  }

  static String get baseUrl {
    if (_runtimeServerHost != null && _runtimeServerPort != null) {
      return '${_originFromHostPort(_runtimeServerHost!, _runtimeServerPort!)}/api';
    }
    if (_envBaseUrl.isNotEmpty) {
      return _envBaseUrl;
    }

    if (kIsWeb) {
      final base = Uri.base;
      final isLocalHost = base.host == 'localhost' || base.host == '127.0.0.1';
      final isDevPort = base.port != 80 && base.port != 443;
      if (isLocalHost && isDevPort) {
        return 'https://localhost/api';
      }
      return '${base.origin}/api';
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'https://10.0.2.2/api';
      default:
        return 'http://localhost:3000/api';
    }
  }

  static Uri get apiUri => Uri.parse(baseUrl);

  static String get socketUrl {
    if (_runtimeServerHost != null && _runtimeServerPort != null) {
      return _originFromHostPort(_runtimeServerHost!, _runtimeServerPort!);
    }
    if (_envSocketUrl.isNotEmpty) {
      return _envSocketUrl;
    }

    if (kIsWeb) {
      final base = Uri.base;
      final isLocalHost = base.host == 'localhost' || base.host == '127.0.0.1';
      final isDevPort = base.port != 80 && base.port != 443;
      if (isLocalHost && isDevPort) {
        return 'https://localhost';
      }
      return base.origin;
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'https://10.0.2.2';
      default:
        return apiUri.origin;
    }
  }

  static const String apiKey = String.fromEnvironment(
    'API_KEY',
    defaultValue: 'meeting-room-secret-key-2024',
  );
  static const bool trustSelfSigned = bool.fromEnvironment(
    'TRUST_SELF_SIGNED',
    defaultValue: false,
  );
  static const String selfSignedHost = String.fromEnvironment(
    'SELF_SIGNED_HOST',
    defaultValue: '10.0.2.2',
  );

  final String? originOverride;

  ApiService({this.originOverride});

  Uri get _apiUri {
    if (originOverride != null && originOverride!.trim().isNotEmpty) {
      final origin = originOverride!.trim();
      return Uri.parse('$origin/api');
    }
    return apiUri;
  }

  http.Client get _client {
    final hosts = <String>{selfSignedHost};
    if (_runtimeServerHost != null && _runtimeServerHost!.trim().isNotEmpty) {
      hosts.add(_runtimeServerHost!.trim());
    }
    if (originOverride != null) {
      try {
        hosts.add(Uri.parse(originOverride!).host);
      } catch (_) {}
    }

    return createHttpClient(
      trustSelfSigned: trustSelfSigned,
      allowedBadCertHosts: hosts,
    );
  }

  Map<String, String> get _defaultHeaders => {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      };

  Future<Map<String, dynamic>> adminLogin({
    required String username,
    required String password,
    Duration timeout = const Duration(seconds: 6),
  }) async {
    Future<http.Response> postTo(String path) {
      final uri = _apiUri.replace(path: '${_apiUri.path}$path');
      return _client
          .post(
            uri,
            headers: const {'Content-Type': 'application/json'},
            body: json.encode({'username': username, 'password': password}),
          )
          .timeout(timeout);
    }

    http.Response resp;
    try {
      resp = await postTo('/admin/login');
    } catch (_) {
      resp = await postTo('/auth/login');
    }

    if (resp.statusCode != 200) {
      final fallback = await postTo('/auth/login');
      resp = fallback;
    }

    if (resp.statusCode == 200) {
      final data = json.decode(resp.body);
      if (data is Map) return Map<String, dynamic>.from(data);
      return {};
    }

    throw Exception(resp.body.isNotEmpty ? resp.body : 'Failed to login');
  }

  Future<List<Order>> fetchOrders() async {
    final response = await _client.get(
      _apiUri.replace(path: '${_apiUri.path}/orders'),
      headers: _defaultHeaders,
    );

    if (response.statusCode == 200) {
      List<dynamic> data = json.decode(response.body);
      return data.map((json) => Order.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load orders');
    }
  }

  Future<Order> createOrder(String roomId, List<OrderItem> items) async {
    final response = await _client.post(
      _apiUri.replace(path: '${_apiUri.path}/orders'),
      headers: _defaultHeaders,
      body: json.encode({
        'roomId': roomId,
        'items': items.map((item) => item.toJson()).toList(),
      }),
    );

    if (response.statusCode == 201) {
      return Order.fromJson(json.decode(response.body));
    } else {
      throw Exception(response.body.isNotEmpty ? response.body : 'Failed to create order');
    }
  }

  Future<Order> updateOrderStatus(String orderId, OrderStatus status) async {
    final response = await _client.patch(
      _apiUri.replace(path: '${_apiUri.path}/orders/$orderId/status'),
      headers: _defaultHeaders,
      body: json.encode({'status': status.name}),
    );

    if (response.statusCode == 200) {
      return Order.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to update order');
    }
  }

  Future<List<Map<String, dynamic>>> fetchMenuItems({bool activeOnly = true}) async {
    final qs = activeOnly ? '?active=true' : '';
    final response = await _client.get(
      _apiUri.replace(path: '${_apiUri.path}/menu', query: qs.isEmpty ? null : 'active=true'),
      headers: _defaultHeaders,
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data is List) {
        return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } else {
      throw Exception(response.body.isNotEmpty ? response.body : 'Failed to load menu');
    }
  }

  Future<List<Map<String, dynamic>>> fetchRooms() async {
    final response = await _client.get(
      _apiUri.replace(path: '${_apiUri.path}/rooms'),
      headers: _defaultHeaders,
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data is List) {
        return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } else {
      throw Exception(response.body.isNotEmpty ? response.body : 'Failed to load rooms');
    }
  }

  Future<List<Map<String, dynamic>>> fetchServiceCounters() async {
    final response = await _client.get(
      _apiUri.replace(path: '${_apiUri.path}/service-counters'),
      headers: _defaultHeaders,
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data is List) {
        return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } else {
      throw Exception(response.body.isNotEmpty ? response.body : 'Failed to load service counters');
    }
  }

  Future<List<Map<String, dynamic>>> fetchCategories() async {
    final response = await _client.get(
      _apiUri.replace(path: '${_apiUri.path}/categories'),
      headers: _defaultHeaders,
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data is List) {
        return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } else {
      throw Exception(response.body.isNotEmpty ? response.body : 'Failed to load categories');
    }
  }
}
