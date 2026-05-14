import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../providers/locale_provider.dart';
import '../models/order.dart';
import '../providers/order_provider.dart';
import '../services/api_service.dart';

class KioskScreen extends StatefulWidget {
  const KioskScreen({super.key});

  @override
  State<KioskScreen> createState() => _KioskScreenState();
}

class _KioskScreenState extends State<KioskScreen> {
  final _roomIdController = TextEditingController();
  final List<OrderItem> _cart = [];

  final ApiService _apiService = ApiService();
  Timer? _pollTimer;

  List<Map<String, dynamic>> _menu = [];
  List<Map<String, dynamic>> _rooms = [];
  Map<String, Map<String, String>> _categoryKeyToNames = {};
  Map<String, String> _categoryKeyToImageUrl = {};
  bool _loading = true;
  String? _selectedRoomCode;
  String _selectedCategory = '';
  bool _isLocked = false;
  String? _lockedRoomCode;
  bool _isApplyingConfig = false;

  List<String> get _preferredCategories => const [
    'Drinks',
    'Snacks',
    'Tidy Up',
  ];

  String get _langCode => context.watch<AppLocaleProvider>().locale.appCode;

  String t(String key) {
    const dict = {
      'zh': {
        'title': '点餐台',
        'refresh': '刷新',
        'settings': '设置',
        'categories': '分类',
        'room': '房间',
        'room_locked': '房间（已锁定）',
        'room_id': '房间标识',
        'submit_order': '提交订单',
        'no_category': '未选择分类',
        'no_items': '该分类暂无商品',
        'sold_out': '售罄',
        'stock': '库存',
        'please_add_items': '请先添加商品',
        'please_enter_room': '请输入房间',
        'admin_login': '管理员登录',
        'username': '用户名',
        'password': '密码',
        'server_ip': '服务器 IP',
        'port': '端口',
        'cancel': '取消',
        'login': '登录',
        'device_settings': '设备设置（点餐台）',
        'save_lock': '保存并锁定',
        'optional_room': '默认房间（可选）',
        'no_bind_room': '不绑定房间（可选）',
        'enter_admin': '请输入管理员账号和密码。',
        'login_failed': '登录失败，请检查账号/密码或服务器。',
        'connect_failed_enter_ip': '连接失败，请输入临时服务器 IP 和端口后重试。',
      },
      'en': {
        'title': 'Ordering Kiosk',
        'refresh': 'Refresh',
        'settings': 'Settings',
        'categories': 'Categories',
        'room': 'Room',
        'room_locked': 'Room (Locked)',
        'room_id': 'Room ID',
        'submit_order': 'Submit Order',
        'no_category': 'No category selected',
        'no_items': 'No items in this category',
        'sold_out': 'Sold Out',
        'stock': 'Stock',
        'please_add_items': 'Please add items to cart',
        'please_enter_room': 'Please enter room ID',
        'admin_login': 'Admin Login',
        'username': 'Username',
        'password': 'Password',
        'server_ip': 'Server IP',
        'port': 'Port',
        'cancel': 'Cancel',
        'login': 'Login',
        'device_settings': 'Device Settings (Kiosk)',
        'save_lock': 'Save & Lock',
        'optional_room': 'Default Room (Optional)',
        'no_bind_room': 'No room (Optional)',
        'enter_admin': 'Please enter admin username and password.',
        'login_failed': 'Login failed. Check credentials or server.',
        'connect_failed_enter_ip':
            'Connection failed. Please enter a server IP/port and try again.',
      },
      'zh-Hant': {
        'title': '點餐台',
        'refresh': '刷新',
        'settings': '設定',
        'categories': '分類',
        'room': '房間',
        'room_locked': '房間（已鎖定）',
        'room_id': '房間識別',
        'submit_order': '提交訂單',
        'no_category': '未選擇分類',
        'no_items': '該分類暫無商品',
        'sold_out': '售罄',
        'stock': '庫存',
        'please_add_items': '請先添加商品',
        'please_enter_room': '請輸入房間',
        'admin_login': '管理員登入',
        'username': '用戶名',
        'password': '密碼',
        'server_ip': '伺服器 IP',
        'port': '連接埠',
        'cancel': '取消',
        'login': '登入',
        'device_settings': '設備設定（點餐台）',
        'save_lock': '保存並鎖定',
        'optional_room': '預設房間（可選）',
        'no_bind_room': '不綁定房間（可選）',
        'enter_admin': '請輸入管理員用戶名與密碼。',
        'login_failed': '登入失敗，請檢查帳號/密碼或伺服器。',
        'connect_failed_enter_ip': '連線失敗，請輸入臨時伺服器 IP 與連接埠後重試。',
      },
    };
    final m = dict[_langCode] ?? dict['zh']!;
    return (m[key] ?? (dict['zh']![key] ?? key)).toString();
  }

  String _displayNameForMenu(Map<String, dynamic> item) {
    final name = (item['name'] ?? '').toString().trim();
    String v;
    if (_langCode == 'en') {
      v = (item['nameEn'] ?? item['name_en'] ?? '').toString().trim();
    } else if (_langCode == 'zh-Hant') {
      v = (item['nameHant'] ?? item['name_hant'] ?? '').toString().trim();
    } else {
      v = (item['nameZh'] ?? item['name_zh'] ?? '').toString().trim();
    }
    return v.isNotEmpty ? v : name;
  }

  String _displayNameForInternal(String internalName) {
    final n = internalName.trim();
    final m = _menu.firstWhere(
      (x) => ((x['name'] ?? '') as String?)?.trim() == n,
      orElse: () => const <String, dynamic>{},
    );
    if (m.isEmpty) return n;
    return _displayNameForMenu(m);
  }

  String _resolveImageUrl(String url) {
    final u = url.trim();
    if (u.isEmpty) return '';
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    final origin = ApiService.apiUri.origin;
    if (u.startsWith('/')) return '$origin$u';
    return '$origin/$u';
  }

  String _displayCategory(String key) {
    final k = key.trim();
    if (k.isEmpty) return '';
    final bundle = _categoryKeyToNames[k];
    if (bundle == null) return k;
    final v = bundle[_langCode] ?? bundle['zh'] ?? '';
    final s = v.trim();
    return s.isNotEmpty ? s : k;
  }

  String _categoryIconUrl(String key) {
    final k = key.trim();
    if (k.isEmpty) return '';
    return (_categoryKeyToImageUrl[k] ?? '').trim();
  }

  List<String> get _categories {
    final apiKeys = _categoryKeyToNames.keys.toList();
    if (apiKeys.isNotEmpty) {
      apiKeys.sort();
      return apiKeys;
    }

    final set = <String>{};
    for (final m in _menu) {
      final c = (m['category'] as String?)?.trim();
      if (c != null && c.isNotEmpty) set.add(c);
    }
    final discovered = set.toList()..sort();
    final preferred = _preferredCategories
        .where((c) => set.contains(c))
        .toList();
    final rest = discovered.where((c) => !preferred.contains(c)).toList();
    return [...preferred, ...rest];
  }

  List<Map<String, dynamic>> get _visibleMenuForCategory {
    return _menu
        .where((m) => (m['category'] as String?) == _selectedCategory)
        .toList()
      ..sort(
        (a, b) => _displayNameForMenu(a).compareTo(_displayNameForMenu(b)),
      );
  }

  @override
  void initState() {
    super.initState();
    _loadDeviceConfig().then((_) => _loadInitial());
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      _refreshMenuOnly();
    });
  }

  Future<void> _loadDeviceConfig() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final locked = prefs.getBool('kiosk_locked') ?? false;
      final room = (prefs.getString('kiosk_room_code') ?? '').trim();
      if (!mounted) return;
      setState(() {
        _isLocked = locked;
        _lockedRoomCode = room.isEmpty ? null : room;
      });
    } catch (_) {}
  }

  Future<void> _loadInitial() async {
    try {
      final rooms = await _apiService.fetchRooms();
      final menu = await _apiService.fetchMenuItems(activeOnly: true);
      final categories = await _apiService.fetchCategories();

      if (!mounted) return;
      setState(() {
        _rooms = rooms;
        _menu = menu;
        final map = <String, Map<String, String>>{};
        final iconMap = <String, String>{};
        for (final c in categories) {
          final key = (c['name'] ?? '').toString().trim();
          if (key.isEmpty) continue;
          final zh = (c['nameZh'] ?? c['name_zh'] ?? key).toString().trim();
          final en = (c['nameEn'] ?? c['name_en'] ?? '').toString().trim();
          final hant = (c['nameHant'] ?? c['name_hant'] ?? '')
              .toString()
              .trim();
          final imageUrl = (c['imageUrl'] ?? c['image_url'] ?? '')
              .toString()
              .trim();
          map[key] = {
            'zh': zh.isNotEmpty ? zh : key,
            'en': en.isNotEmpty ? en : (zh.isNotEmpty ? zh : key),
            'zh-Hant': hant.isNotEmpty ? hant : (zh.isNotEmpty ? zh : key),
          };
          if (imageUrl.isNotEmpty) {
            iconMap[key] = imageUrl;
          }
        }
        _categoryKeyToNames = map;
        _categoryKeyToImageUrl = iconMap;
        _loading = false;

        if (_rooms.isNotEmpty) {
          final locked = _lockedRoomCode;
          if (_isLocked && locked != null && locked.isNotEmpty) {
            _selectedRoomCode = locked;
            _roomIdController.text = locked;
          } else {
            final first = _rooms.first;
            _selectedRoomCode = (first['code'] as String?) ?? '';
            _roomIdController.text = _selectedRoomCode ?? '';
          }
        } else if (_roomIdController.text.isEmpty) {
          _roomIdController.text = 'room-101';
        }

        final cats = _categories.isNotEmpty
            ? _categories
            : _preferredCategories;
        if (cats.isNotEmpty) {
          _selectedCategory = cats.first;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('加载菜单/房间失败：$e')));
      }
    }
  }

  Future<void> _refreshMenuOnly() async {
    try {
      final menu = await _apiService.fetchMenuItems(activeOnly: true);
      final categories = await _apiService.fetchCategories();
      if (!mounted) return;
      setState(() {
        _menu = menu;
        final map = <String, Map<String, String>>{};
        final iconMap = <String, String>{};
        for (final c in categories) {
          final key = (c['name'] ?? '').toString().trim();
          if (key.isEmpty) continue;
          final zh = (c['nameZh'] ?? c['name_zh'] ?? key).toString().trim();
          final en = (c['nameEn'] ?? c['name_en'] ?? '').toString().trim();
          final hant = (c['nameHant'] ?? c['name_hant'] ?? '')
              .toString()
              .trim();
          final imageUrl = (c['imageUrl'] ?? c['image_url'] ?? '')
              .toString()
              .trim();
          map[key] = {
            'zh': zh.isNotEmpty ? zh : key,
            'en': en.isNotEmpty ? en : (zh.isNotEmpty ? zh : key),
            'zh-Hant': hant.isNotEmpty ? hant : (zh.isNotEmpty ? zh : key),
          };
          if (imageUrl.isNotEmpty) {
            iconMap[key] = imageUrl;
          }
        }
        _categoryKeyToNames = map;
        _categoryKeyToImageUrl = iconMap;
        final cats = _categories.isNotEmpty
            ? _categories
            : _preferredCategories;
        if (_selectedCategory.isEmpty) {
          _selectedCategory = cats.isNotEmpty ? cats.first : '';
        }
        if (_selectedCategory.isNotEmpty &&
            !cats.contains(_selectedCategory) &&
            cats.isNotEmpty) {
          _selectedCategory = cats.first;
        }
      });
    } catch (_) {}
  }

  Widget _buildRoomPicker() {
    final decoration = InputDecoration(
      isDense: true,
      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      labelText: t('room'),
      border: OutlineInputBorder(),
      prefixIcon: Icon(Icons.room, size: 18),
      prefixIconConstraints: BoxConstraints(minWidth: 44, minHeight: 44),
    );

    if (_rooms.isEmpty) {
      return TextField(
        controller: _roomIdController,
        decoration: decoration.copyWith(labelText: t('room_id')),
      );
    }

    if (_isLocked && _lockedRoomCode != null && _lockedRoomCode!.isNotEmpty) {
      final code = _lockedRoomCode!;
      final r = _rooms.where((x) => (x['code'] as String?) == code).toList();
      final name = r.isNotEmpty ? ((r.first['name'] as String?) ?? code) : code;
      return InputDecorator(
        decoration: decoration.copyWith(labelText: t('room_locked')),
        child: Row(
          children: [
            Expanded(child: Text('$name ($code)')),
            const SizedBox(width: 8),
            Icon(Icons.lock, size: 18, color: Colors.grey[600]),
          ],
        ),
      );
    }

    return DropdownButtonFormField<String>(
      key: ValueKey(_selectedRoomCode),
      initialValue: _selectedRoomCode,
      items: _rooms.map((r) {
        final code = (r['code'] as String?) ?? '';
        final name = (r['name'] as String?) ?? code;
        return DropdownMenuItem(value: code, child: Text('$name ($code)'));
      }).toList(),
      onChanged: (v) {
        setState(() {
          _selectedRoomCode = v;
          _roomIdController.text = v ?? '';
        });
      },
      decoration: decoration,
    );
  }

  Widget _buildCategorySidebar(List<String> categories) {
    final effective = categories.isNotEmpty ? categories : _preferredCategories;
    return Container(
      width: 232,
      decoration: BoxDecoration(
        color: Colors.grey[200],
        border: Border(right: BorderSide(color: Colors.grey[300]!)),
      ),
      child: SafeArea(
        right: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: Text(
                t('categories'),
                style: TextStyle(
                  color: Colors.grey[700],
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.2,
                ),
              ),
            ),
            Expanded(
              child: ListView.builder(
                itemCount: effective.length,
                itemBuilder: (context, index) {
                  final cat = effective[index];
                  final selected = _selectedCategory == cat;
                  return Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 4,
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () {
                        setState(() {
                          _selectedCategory = cat;
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: selected
                              ? Colors.blue[50]
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: selected
                                ? Colors.blue[200]!
                                : Colors.transparent,
                          ),
                        ),
                        child: Row(
                          children: [
                            if (selected)
                              Container(
                                width: 4,
                                height: 22,
                                decoration: BoxDecoration(
                                  color: Colors.blue[700],
                                  borderRadius: BorderRadius.circular(999),
                                ),
                              )
                            else
                              const SizedBox(width: 4, height: 22),
                            const SizedBox(width: 12),
                            SizedBox(
                              width: 36,
                              height: 36,
                              child: Builder(
                                builder: (context) {
                                  final url = _categoryIconUrl(cat);
                                  final fallback = Icon(
                                    Icons.category,
                                    size: 22,
                                    color: selected
                                        ? Colors.blue[700]
                                        : Colors.grey[700],
                                  );

                                  if (url.isEmpty)
                                    return Center(child: fallback);

                                  return CachedNetworkImage(
                                    imageUrl: _resolveImageUrl(url),
                                    width: 36,
                                    height: 36,
                                    fit: BoxFit.contain,
                                    placeholder: (context, _) =>
                                        Center(child: fallback),
                                    errorWidget: (context, _, _) =>
                                        Center(child: fallback),
                                  );
                                },
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _displayCategory(cat),
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: selected
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                  color: selected
                                      ? Colors.blue[900]
                                      : Colors.grey[800],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuGrid(
    List<Map<String, dynamic>> itemsForCategory, {
    required int columns,
  }) {
    if (_selectedCategory.isEmpty) {
      return Center(child: Text(t('no_category')));
    }
    if (itemsForCategory.isEmpty) {
      return Center(child: Text(t('no_items')));
    }

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: columns,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 2.6,
      ),
      itemCount: itemsForCategory.length,
      itemBuilder: (context, index) {
        final item = itemsForCategory[index];
        final name = (item['name'] as String?) ?? '';
        final rawImageUrl = (item['imageUrl'] ?? item['image_url'] ?? '')
            .toString()
            .trim();
        final imageUrl = _resolveImageUrl(rawImageUrl);
        final stock = (item['stock'] as num?)?.toInt() ?? 0;
        final soldOut = stock <= 0;
        final displayName = _displayNameForMenu(item);

        return LayoutBuilder(
          builder: (context, constraints) {
            final imageSize = (constraints.maxHeight * 0.85).clamp(56.0, 110.0);
            return InkWell(
              onTap: soldOut ? null : () => _addToCart(name),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: EdgeInsets.zero,
                decoration: BoxDecoration(
                  color: soldOut ? Colors.grey[100] : Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey[300]!),
                  boxShadow: [
                    if (!soldOut)
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                  ],
                ),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(16),
                        bottomLeft: Radius.circular(16),
                      ),
                      child: Container(
                        width: imageSize,
                        height: imageSize,
                        color: soldOut ? Colors.grey[300] : Colors.blue[50],
                        child: imageUrl.isNotEmpty
                            ? CachedNetworkImage(
                                imageUrl: imageUrl,
                                fit: BoxFit.cover,
                                placeholder: (context, url) => Icon(
                                  Icons.local_cafe,
                                  color: soldOut
                                      ? Colors.grey[700]
                                      : Colors.blue[700],
                                ),
                                errorWidget: (context, url, error) => Icon(
                                  Icons.local_cafe,
                                  color: soldOut
                                      ? Colors.grey[700]
                                      : Colors.blue[700],
                                ),
                              )
                            : Icon(
                                Icons.local_cafe,
                                color: soldOut
                                    ? Colors.grey[700]
                                    : Colors.blue[700],
                              ),
                      ),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 14,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              displayName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: soldOut
                                    ? Colors.grey[700]
                                    : Colors.grey[900],
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                if (soldOut)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.red[50],
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(
                                        color: Colors.red[200]!,
                                      ),
                                    ),
                                    child: Text(
                                      t('sold_out'),
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.red[800],
                                      ),
                                    ),
                                  )
                                else
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.green[50],
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(
                                        color: Colors.green[200]!,
                                      ),
                                    ),
                                    child: Text(
                                      '${t('stock')}: $stock',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.green[800],
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(right: 14),
                      child: Icon(
                        Icons.add_circle,
                        color: soldOut ? Colors.grey[400] : Colors.blue[700],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _addToCart(String itemName) {
    final existingIndex = _cart.indexWhere((item) => item.name == itemName);
    if (existingIndex != -1) {
      setState(() {
        _cart[existingIndex] = OrderItem(
          name: itemName,
          qty: _cart[existingIndex].qty + 1,
        );
      });
    } else {
      setState(() {
        _cart.add(OrderItem(name: itemName, qty: 1));
      });
    }
  }

  void _updateQty(String itemName, int delta) {
    final index = _cart.indexWhere((item) => item.name == itemName);
    if (index != -1) {
      final newQty = _cart[index].qty + delta;
      if (newQty <= 0) {
        setState(() {
          _cart.removeAt(index);
        });
      } else {
        setState(() {
          _cart[index] = OrderItem(name: itemName, qty: newQty);
        });
      }
    }
  }

  Future<void> _submitOrder() async {
    if (_cart.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(t('please_add_items'))));
      return;
    }
    if (_roomIdController.text.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(t('please_enter_room'))));
      return;
    }

    final provider = Provider.of<OrderProvider>(context, listen: false);
    final order = await provider.createOrder(_roomIdController.text, _cart);

    if (order != null && mounted) {
      setState(() {
        _cart.clear();
      });
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('${t('submit_order')} OK')));
      }
      await _refreshMenuOnly();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final categories = _categories.isNotEmpty
        ? _categories
        : _preferredCategories;
    final itemsForCategory = _visibleMenuForCategory;

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 48,
        titleSpacing: 12,
        title: Text(
          t('title'),
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.language),
            tooltip: 'Language',
            onSelected: (v) {
              final p = context.read<AppLocaleProvider>();
              if (v == 'en') p.setLocale(const Locale('en'));
              if (v == 'zh') p.setLocale(const Locale('zh'));
              if (v == 'zh-Hant')
                p.setLocale(
                  const Locale.fromSubtags(
                    languageCode: 'zh',
                    scriptCode: 'Hant',
                  ),
                );
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'zh', child: Text('简体中文')),
              PopupMenuItem(value: 'zh-Hant', child: Text('繁體中文')),
              PopupMenuItem(value: 'en', child: Text('English')),
            ],
          ),
          IconButton(
            onPressed: _openLockedSettings,
            icon: const Icon(Icons.settings),
            tooltip: 'Settings',
          ),
          IconButton(
            onPressed: _refreshMenuOnly,
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Row(
        children: [
          _buildCategorySidebar(categories),
          Expanded(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
                  child: SizedBox(height: 46, child: _buildRoomPicker()),
                ),
                Expanded(child: _buildMenuGrid(itemsForCategory, columns: 2)),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    border: Border(top: BorderSide(color: Colors.grey[300]!)),
                  ),
                  child: SafeArea(
                    top: false,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_cart.isNotEmpty)
                          SizedBox(
                            height: 140,
                            child: ListView.builder(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              itemCount: _cart.length,
                              itemBuilder: (context, index) {
                                final item = _cart[index];
                                return ListTile(
                                  dense: true,
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(
                                    _displayNameForInternal(item.name),
                                  ),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.remove),
                                        onPressed: () =>
                                            _updateQty(item.name, -1),
                                      ),
                                      Text(
                                        '${item.qty}',
                                        style: const TextStyle(fontSize: 18),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.add),
                                        onPressed: () =>
                                            _updateQty(item.name, 1),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
                          child: SizedBox(
                            width: double.infinity,
                            height: 46,
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.blue,
                                foregroundColor: Colors.white,
                              ),
                              onPressed: _cart.isEmpty ? null : _submitOrder,
                              icon: const Icon(Icons.send),
                              label: Text(
                                '${t('submit_order')} (${_cart.length})',
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _roomIdController.dispose();
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _openLockedSettings() async {
    if (_isApplyingConfig) return;

    final login = await _showAdminLoginDialog();
    if (login == null) return;

    final rooms = await _fetchRoomsForSettings(login.origin);
    if (!mounted) return;

    final savedRoom = _lockedRoomCode ?? _selectedRoomCode ?? '';
    final next = await _showKioskConfigDialog(
      origin: login.origin,
      initialHost: login.host,
      initialPort: login.port,
      rooms: rooms,
      initialRoomCode: savedRoom,
    );
    if (next == null) return;

    await _applyKioskConfig(next);
  }

  Future<List<Map<String, dynamic>>> _fetchRoomsForSettings(
    String origin,
  ) async {
    try {
      return await ApiService(originOverride: origin).fetchRooms();
    } catch (_) {
      return [];
    }
  }

  Future<void> _applyKioskConfig(_KioskConfig next) async {
    final nav = Navigator.of(context, rootNavigator: true);

    setState(() {
      _isApplyingConfig = true;
    });

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    try {
      await ApiService.saveServerToPrefs(host: next.host, port: next.port);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('kiosk_locked', true);
      await prefs.setString('kiosk_room_code', next.roomCode ?? '');

      await _loadDeviceConfig();
      await _loadInitial();
    } finally {
      if (mounted) {
        nav.pop();
        setState(() {
          _isApplyingConfig = false;
        });
      }
    }
  }

  Future<_AdminLoginResult?> _showAdminLoginDialog() async {
    final usernameCtrl = TextEditingController();
    final passwordCtrl = TextEditingController();
    final ipCtrl = TextEditingController();
    final portCtrl = TextEditingController();

    String? message;
    bool showManual = false;
    bool loading = false;

    final savedHost = await _readSavedHost();
    final savedPort = await _readSavedPort();
    if (savedHost != null) ipCtrl.text = savedHost;
    if (savedPort != null) portCtrl.text = savedPort.toString();

    if (!mounted) return null;
    final result = await showDialog<_AdminLoginResult>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            Future<void> doLogin({required bool useManual}) async {
              final u = usernameCtrl.text.trim();
              final p = passwordCtrl.text;
              if (u.isEmpty || p.isEmpty) {
                setState(() {
                  message = '请输入管理员账号和密码。';
                });
                return;
              }

              loading = true;
              setState(() {});

              try {
                final origin = useManual
                    ? _originFromFields(ipCtrl.text, portCtrl.text)
                    : null;
                final svc = ApiService(originOverride: origin);
                await svc.adminLogin(username: u, password: p);

                if (!context.mounted) return;
                final parsed = Uri.parse(origin ?? ApiService.socketUrl);
                Navigator.of(context).pop(
                  _AdminLoginResult(
                    origin: origin ?? ApiService.socketUrl,
                    host: parsed.host,
                    port: parsed.hasPort
                        ? parsed.port
                        : (parsed.scheme == 'https' ? 443 : 80),
                  ),
                );
              } catch (e) {
                final text = e.toString();
                if (!useManual &&
                    (text.contains('SocketException') ||
                        text.contains('TimeoutException'))) {
                  showManual = true;
                  message = '连接失败，请输入临时服务器 IP 和端口后重试。';
                } else {
                  message = '登录失败，请检查账号/密码或服务器。';
                }
              } finally {
                loading = false;
                setState(() {});
              }
            }

            return AlertDialog(
              title: const Text('Admin Login'),
              content: SizedBox(
                width: 360,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: usernameCtrl,
                      decoration: const InputDecoration(labelText: 'Username'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: passwordCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Password'),
                    ),
                    const SizedBox(height: 10),
                    if (showManual) ...[
                      TextField(
                        controller: ipCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Server IP',
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: portCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Port'),
                      ),
                      const SizedBox(height: 10),
                    ],
                    if (message != null)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          message!,
                          style: TextStyle(color: Colors.red[700]),
                        ),
                      ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: loading ? null : () => Navigator.of(context).pop(),
                  child: const Text('取消'),
                ),
                ElevatedButton(
                  onPressed: loading
                      ? null
                      : () => doLogin(useManual: showManual),
                  child: loading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('登录'),
                ),
              ],
            );
          },
        );
      },
    );

    usernameCtrl.dispose();
    passwordCtrl.dispose();
    ipCtrl.dispose();
    portCtrl.dispose();
    return result;
  }

  Future<_KioskConfig?> _showKioskConfigDialog({
    required String origin,
    required String initialHost,
    required int initialPort,
    required List<Map<String, dynamic>> rooms,
    required String initialRoomCode,
  }) async {
    final hostCtrl = TextEditingController(text: initialHost);
    final portCtrl = TextEditingController(text: initialPort.toString());
    String? selectedRoom = initialRoomCode.trim().isEmpty
        ? null
        : initialRoomCode.trim();

    if (!mounted) return null;
    final result = await showDialog<_KioskConfig>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            final roomItems = rooms.map((r) {
              final code = (r['code'] ?? '').toString();
              final name = (r['name'] ?? code).toString();
              return DropdownMenuItem<String?>(
                value: code,
                child: Text('$name ($code)'),
              );
            }).toList();

            return AlertDialog(
              title: const Text('设备设置（Kiosk）'),
              content: SizedBox(
                width: 420,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: hostCtrl,
                      decoration: const InputDecoration(labelText: '服务器 IP'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: portCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: '端口'),
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String?>(
                      initialValue: selectedRoom,
                      items: [
                        const DropdownMenuItem<String?>(
                          value: null,
                          child: Text('不绑定房间（可选）'),
                        ),
                        ...roomItems,
                      ],
                      onChanged: (v) => setState(() => selectedRoom = v),
                      decoration: const InputDecoration(labelText: '默认房间（可选）'),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('取消'),
                ),
                ElevatedButton(
                  onPressed: () {
                    final host = hostCtrl.text.trim();
                    final port = int.tryParse(portCtrl.text.trim()) ?? 0;
                    if (host.isEmpty || port <= 0) return;
                    Navigator.of(context).pop(
                      _KioskConfig(
                        host: host,
                        port: port,
                        roomCode: selectedRoom,
                      ),
                    );
                  },
                  child: const Text('保存并锁定'),
                ),
              ],
            );
          },
        );
      },
    );

    hostCtrl.dispose();
    portCtrl.dispose();
    return result;
  }

  String _originFromFields(String host, String portText) {
    final h = host.trim();
    final p = int.tryParse(portText.trim());
    if (h.isEmpty || p == null || p <= 0) return ApiService.socketUrl;
    final scheme = p == 443 ? 'https' : 'http';
    return '$scheme://$h:$p';
  }

  Future<String?> _readSavedHost() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final host = (prefs.getString('server_host') ?? '').trim();
      return host.isEmpty ? null : host;
    } catch (_) {
      return null;
    }
  }

  Future<int?> _readSavedPort() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getInt('server_port');
    } catch (_) {
      return null;
    }
  }
}

class _AdminLoginResult {
  final String origin;
  final String host;
  final int port;

  _AdminLoginResult({
    required this.origin,
    required this.host,
    required this.port,
  });
}

class _KioskConfig {
  final String host;
  final int port;
  final String? roomCode;

  _KioskConfig({
    required this.host,
    required this.port,
    required this.roomCode,
  });
}
