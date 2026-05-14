import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/order.dart';
import '../providers/locale_provider.dart';
import '../providers/order_provider.dart';
import '../services/api_service.dart';

class CounterScreen extends StatefulWidget {
  const CounterScreen({super.key});

  @override
  State<CounterScreen> createState() => _CounterScreenState();
}

class _CounterScreenState extends State<CounterScreen> with TickerProviderStateMixin {
  final ApiService _api = ApiService();
  final GlobalKey _completedPanelKey = GlobalKey();

  List<Map<String, dynamic>> _serviceCounters = [];
  Map<String, String?> _menuItemToCounterId = {};
  Map<String, String> _menuItemToCategory = {};
  Map<String, Map<String, String>> _menuItemToNames = {};
  Map<String, Map<String, String>> _categoryKeyToNames = {};
  Map<String, String> _roomCodeToName = {};

  String _selectedServiceCounterId = '';
  bool _isLoadingMeta = true;
  bool _isAdminView = false;
  bool _isLocked = false;
  bool _isApplyingConfig = false;

  DateTime _now = DateTime.now();
  Timer? _tick;

  final Map<String, GlobalKey> _pendingCardKeys = {};
  final Set<String> _animatingOrderIds = {};

  String get _langCode => context.watch<AppLocaleProvider>().locale.appCode;

  String t(String key) {
    const dict = {
      'zh': {
        'all_counters': '全部柜台',
        'counter': '柜台',
        'counter_unset': '未指定柜台',
        'pending': '待处理',
        'pending_sub': 'Pending / Processing',
        'completed': '已完成',
        'completed_sub': '最近 1 小时',
        'no_orders': '暂无订单',
        'no_pending': '暂无待处理订单',
        'no_completed': '暂无最近 1 小时已完成订单',
        'live': 'Live',
        'disconnected': 'Disconnected',
        'complete': '完成',
        'pending_tag': '待处理',
        'completed_tag': '已完成',
        'elapsed': '已下单',
        'order_time': '下单时间',
        'complete_failed': '标记完成失败，请稍后重试。',
        'admin_login': '管理员登录',
        'username': '用户名',
        'password': '密码',
        'server_ip': '服务器 IP',
        'port': '端口',
        'cancel': '取消',
        'login': '登录',
        'device_settings': '设备设置（Service Counter）',
        'bind_counter': '绑定柜台',
        'save_lock': '保存并锁定',
        'connect_failed_enter_ip': '连接失败，请输入临时服务器 IP 和端口后重试。',
        'login_failed': '登录失败，请检查账号/密码或服务器。',
        'enter_admin': '请输入管理员账号和密码。',
      },
      'en': {
        'all_counters': 'All Counters',
        'counter': 'Counter',
        'counter_unset': 'No counter',
        'pending': 'Pending',
        'pending_sub': 'Pending / Processing',
        'completed': 'Completed',
        'completed_sub': 'Last 1 hour',
        'no_orders': 'No orders',
        'no_pending': 'No pending orders',
        'no_completed': 'No completed orders in last hour',
        'live': 'Live',
        'disconnected': 'Disconnected',
        'complete': 'Complete',
        'pending_tag': 'PENDING',
        'completed_tag': 'COMPLETED',
        'elapsed': 'Elapsed',
        'order_time': 'Order time',
        'complete_failed': 'Failed to complete. Please try again.',
        'admin_login': 'Admin Login',
        'username': 'Username',
        'password': 'Password',
        'server_ip': 'Server IP',
        'port': 'Port',
        'cancel': 'Cancel',
        'login': 'Login',
        'device_settings': 'Device Settings (Counter)',
        'bind_counter': 'Bind Counter',
        'save_lock': 'Save & Lock',
        'connect_failed_enter_ip': 'Connection failed. Please enter a server IP/port and try again.',
        'login_failed': 'Login failed. Check credentials or server.',
        'enter_admin': 'Please enter admin username and password.',
      },
      'zh-Hant': {
        'all_counters': '全部櫃台',
        'counter': '櫃台',
        'counter_unset': '未指定櫃台',
        'pending': '待處理',
        'pending_sub': 'Pending / Processing',
        'completed': '已完成',
        'completed_sub': '最近 1 小時',
        'no_orders': '暫無訂單',
        'no_pending': '暫無待處理訂單',
        'no_completed': '暫無最近 1 小時已完成訂單',
        'live': 'Live',
        'disconnected': 'Disconnected',
        'complete': '完成',
        'pending_tag': '待處理',
        'completed_tag': '已完成',
        'elapsed': '已下單',
        'order_time': '下單時間',
        'complete_failed': '標記完成失敗，請稍後重試。',
        'admin_login': '管理員登入',
        'username': '用戶名',
        'password': '密碼',
        'server_ip': '伺服器 IP',
        'port': '連接埠',
        'cancel': '取消',
        'login': '登入',
        'device_settings': '設備設定（Service Counter）',
        'bind_counter': '綁定櫃台',
        'save_lock': '保存並鎖定',
        'connect_failed_enter_ip': '連線失敗，請輸入臨時伺服器 IP 與連接埠後重試。',
        'login_failed': '登入失敗，請檢查帳號/密碼或伺服器。',
        'enter_admin': '請輸入管理員用戶名與密碼。',
      },
    };
    final m = dict[_langCode] ?? dict['zh']!;
    return (m[key] ?? (dict['zh']![key] ?? key)).toString();
  }

  String _displayNameForInternal(String internalName) {
    final n = internalName.trim();
    final bundle = _menuItemToNames[n];
    if (bundle == null) return n;
    final v = bundle[_langCode] ?? bundle['zh'] ?? '';
    return v.trim().isNotEmpty ? v : n;
  }

  @override
  void initState() {
    super.initState();
    _initFlagsFromUrl();
    _initSelectedCounterFromUrl();
    _loadDeviceConfig();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _now = DateTime.now();
      });
    });
    _loadMeta();
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  void _initFlagsFromUrl() {
    final qp = Uri.base.queryParameters;
    final admin = (qp['admin'] ?? qp['isAdmin'] ?? '').trim().toLowerCase();
    _isAdminView = admin == '1' || admin == 'true' || admin == 'yes';
  }

  void _initSelectedCounterFromUrl() {
    final qp = Uri.base.queryParameters;
    final id = (qp['serviceCounterId'] ?? qp['counterId'] ?? '').trim();
    if (id.isNotEmpty) {
      _selectedServiceCounterId = id;
    }
  }

  Future<void> _loadDeviceConfig() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final locked = prefs.getBool('counter_locked') ?? false;
      final counterId = (prefs.getString('counter_service_counter_id') ?? '').trim();
      if (!mounted) return;
      setState(() {
        _isLocked = locked;
        if (_isLocked && counterId.isNotEmpty) {
          _isAdminView = false;
          _selectedServiceCounterId = counterId;
        }
      });
    } catch (_) {}
  }

  String _counterNameById(String id) {
    final found = _serviceCounters.firstWhere(
      (c) => (c['id'] ?? '').toString() == id,
      orElse: () => const {},
    );
    String pick(String? v) => (v ?? '').trim();
    final zh = pick((found['nameZh'] ?? found['name_zh'] ?? '').toString());
    final en = pick((found['nameEn'] ?? found['name_en'] ?? '').toString());
    final hant = pick((found['nameHant'] ?? found['name_hant'] ?? '').toString());
    final base = pick((found['name'] ?? id).toString());

    String name;
    if (_langCode == 'en') {
      name = en.isNotEmpty ? en : (zh.isNotEmpty ? zh : (hant.isNotEmpty ? hant : base));
    } else if (_langCode == 'zh-Hant') {
      name = hant.isNotEmpty ? hant : (zh.isNotEmpty ? zh : (en.isNotEmpty ? en : base));
    } else {
      name = zh.isNotEmpty ? zh : base;
    }
    return name.isEmpty ? id : name;
  }

  String _displayCategoryForKey(String key) {
    final k = key.trim();
    if (k.isEmpty) return '';
    final bundle = _categoryKeyToNames[k];
    if (bundle == null) return k;
    final v = bundle[_langCode] ?? bundle['zh'] ?? '';
    final s = v.trim();
    return s.isNotEmpty ? s : k;
  }

  Future<void> _loadMeta() async {
    try {
      final counters = await _api.fetchServiceCounters();
      final menu = await _api.fetchMenuItems(activeOnly: false);
      final rooms = await _api.fetchRooms();
      final categories = await _api.fetchCategories();

      final itemToCounter = <String, String?>{};
      final itemToCategory = <String, String>{};
      final itemToNames = <String, Map<String, String>>{};
      for (final m in menu) {
        final name = (m['name'] ?? '').toString().trim();
        if (name.isEmpty) continue;
        final counterId = m['serviceCounterId'] ?? m['service_counter_id'];
        itemToCounter[name] = counterId?.toString();
        final category = (m['category'] ?? '').toString().trim();
        if (category.isNotEmpty) {
          itemToCategory[name] = category;
        }
        final zh = (m['nameZh'] ?? m['name_zh'] ?? name).toString().trim();
        final en = (m['nameEn'] ?? m['name_en'] ?? '').toString().trim();
        final hant = (m['nameHant'] ?? m['name_hant'] ?? '').toString().trim();
        itemToNames[name] = {
          'zh': zh.isNotEmpty ? zh : name,
          'en': en.isNotEmpty ? en : (zh.isNotEmpty ? zh : name),
          'zh-Hant': hant.isNotEmpty ? hant : (zh.isNotEmpty ? zh : name),
        };
      }

      final roomMap = <String, String>{};
      for (final r in rooms) {
        final code = (r['code'] ?? '').toString().trim();
        if (code.isEmpty) continue;
        final name = (r['name'] ?? code).toString().trim();
        roomMap[code] = name.isEmpty ? code : name;
      }

      final categoryMap = <String, Map<String, String>>{};
      for (final c in categories) {
        final key = (c['name'] ?? '').toString().trim();
        if (key.isEmpty) continue;
        final zh = (c['nameZh'] ?? c['name_zh'] ?? key).toString().trim();
        final en = (c['nameEn'] ?? c['name_en'] ?? '').toString().trim();
        final hant = (c['nameHant'] ?? c['name_hant'] ?? '').toString().trim();
        categoryMap[key] = {
          'zh': zh.isNotEmpty ? zh : key,
          'en': en.isNotEmpty ? en : (zh.isNotEmpty ? zh : key),
          'zh-Hant': hant.isNotEmpty ? hant : (zh.isNotEmpty ? zh : key),
        };
      }

      if (!mounted) return;
      setState(() {
        _serviceCounters = counters;
        _menuItemToCounterId = itemToCounter;
        _menuItemToCategory = itemToCategory;
        _menuItemToNames = itemToNames;
        _categoryKeyToNames = categoryMap;
        _roomCodeToName = roomMap;
        _isLoadingMeta = false;
      });

      if (!_isAdminView && !_isLocked && _selectedServiceCounterId.isEmpty && counters.isNotEmpty) {
        final firstId = (counters.first['id'] ?? '').toString();
        if (firstId.isNotEmpty && mounted) {
          setState(() {
            _selectedServiceCounterId = firstId;
          });
        }
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoadingMeta = false;
      });
    }
  }

  List<OrderItem> _filterItemsForSelectedCounter(List<OrderItem> items) {
    if (_selectedServiceCounterId.isEmpty) return items;
    return items.where((it) {
      final key = it.name.trim();
      final counterId = _menuItemToCounterId[key];
      return counterId != null && counterId == _selectedServiceCounterId;
    }).toList();
  }

  List<Order> _filterOrdersForSelectedCounter(List<Order> orders) {
    if (_selectedServiceCounterId.isEmpty) return orders;
    return orders.where((o) => _filterItemsForSelectedCounter(o.items).isNotEmpty).toList();
  }

  String _roomLabel(String roomCode) {
    final code = roomCode.trim();
    final name = _roomCodeToName[code];
    if (name == null || name.trim().isEmpty || name.trim() == code) return code.isEmpty ? '-' : code;
    return '$name ($code)';
  }

  Future<void> _completeWithFlyAnimation({
    required Order order,
    required List<OrderItem> visibleItems,
    required GlobalKey fromKey,
  }) async {
    if (_animatingOrderIds.contains(order.id)) return;

    final overlay = Overlay.of(context);

    final fromContext = fromKey.currentContext;
    final toContext = _completedPanelKey.currentContext;
    if (fromContext == null || toContext == null) return;

    final fromBox = fromContext.findRenderObject() as RenderBox?;
    final toBox = toContext.findRenderObject() as RenderBox?;
    if (fromBox == null || toBox == null || !fromBox.hasSize || !toBox.hasSize) return;

    final provider = context.read<OrderProvider>();
    final updateFuture = provider.tryUpdateOrderStatus(order.id, OrderStatus.completed);

    final fromTopLeft = fromBox.localToGlobal(Offset.zero);
    final fromRect = fromTopLeft & fromBox.size;

    final toTopLeft = toBox.localToGlobal(const Offset(16, 52));
    final maxWidth = math.max(0.0, toBox.size.width - 32);
    final toRect = Rect.fromLTWH(
      toTopLeft.dx,
      toTopLeft.dy,
      math.min(fromRect.width, maxWidth),
      fromRect.height,
    );

    setState(() {
      _animatingOrderIds.add(order.id);
    });

    late OverlayEntry entry;
    final controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 520));
    final anim = CurvedAnimation(parent: controller, curve: Curves.easeInOutCubicEmphasized);
    final rectTween = RectTween(begin: fromRect, end: toRect);

    entry = OverlayEntry(
      builder: (context) {
        return AnimatedBuilder(
          animation: anim,
          builder: (context, _) {
            final r = rectTween.evaluate(anim)!;
            final opacity = 1.0 - (anim.value * 0.12);
            return Positioned.fromRect(
              rect: r,
              child: IgnorePointer(
                child: Opacity(
                  opacity: opacity,
                  child: Material(
                    color: Colors.transparent,
                    child: CounterOrderCard(
                      key: ValueKey('fly-${order.id}-${order.updatedAt ?? order.createdAt}'),
                      order: order,
                      roomLabel: _roomLabel(order.roomId),
                      now: _now,
                      items: visibleItems,
                      itemToCategory: _menuItemToCategory,
                        displayCategoryForKey: _displayCategoryForKey,
                      displayNameForItem: _displayNameForInternal,
                      pendingTagText: t('pending_tag'),
                      completedTagText: t('completed_tag'),
                      elapsedLabel: t('elapsed'),
                      orderTimeLabel: t('order_time'),
                      completeLabel: t('complete'),
                      showCompleteButton: false,
                      forceStatus: OrderStatus.completed,
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );

    overlay.insert(entry);
    await controller.forward();
    entry.remove();
    controller.dispose();

    final ok = await updateFuture;
    if (!mounted) return;
    if (ok) {
      await provider.fetchOrders();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('complete_failed'))));
    }

    if (!mounted) return;
    setState(() {
      _animatingOrderIds.remove(order.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final counterTitle = _isAdminView
        ? (_selectedServiceCounterId.isEmpty ? t('all_counters') : _counterNameById(_selectedServiceCounterId))
        : (_selectedServiceCounterId.isEmpty ? t('counter') : _counterNameById(_selectedServiceCounterId));

    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text(counterTitle),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.language),
            tooltip: 'Language',
            onSelected: (v) {
              final p = context.read<AppLocaleProvider>();
              if (v == 'en') p.setLocale(const Locale('en'));
              if (v == 'zh') p.setLocale(const Locale('zh'));
              if (v == 'zh-Hant') p.setLocale(const Locale.fromSubtags(languageCode: 'zh', scriptCode: 'Hant'));
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
          if (_isLoadingMeta)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))),
            ),
          if (_isAdminView && !_isLocked) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Center(child: _buildCounterSelector()),
            ),
          ] else ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Text(
                    _selectedServiceCounterId.isEmpty ? t('counter_unset') : _counterNameById(_selectedServiceCounterId),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
          ],
          Consumer<OrderProvider>(
            builder: (context, provider, _) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                margin: const EdgeInsets.only(right: 16),
                decoration: BoxDecoration(
                  color: provider.isConnected ? Colors.green[600] : Colors.red[600],
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  provider.isConnected ? t('live') : t('disconnected'),
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                ),
              );
            },
          ),
        ],
      ),
      body: Consumer<OrderProvider>(
        builder: (context, provider, _) {
          final visible = _isAdminView ? _filterOrdersForSelectedCounter(provider.orders) : _filterOrdersForSelectedCounter(provider.orders);
          final effectiveOrders = visible.where((o) => !_animatingOrderIds.contains(o.id)).toList();

          if (effectiveOrders.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.inbox, size: 72, color: Colors.grey),
                  const SizedBox(height: 12),
                  Text(t('no_orders'), style: const TextStyle(color: Colors.grey)),
                ],
              ),
            );
          }

          final pending = effectiveOrders.where((o) => o.status != OrderStatus.completed).toList()
            ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

          final completedCutoff = _now.subtract(const Duration(hours: 1));
          final completed = effectiveOrders
              .where((o) => o.status == OrderStatus.completed)
              .where((o) => o.updatedAt != null && o.updatedAt!.isAfter(completedCutoff))
              .toList()
            ..sort((a, b) => b.updatedAt!.compareTo(a.updatedAt!));

          return LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 980;
              final pad = wide ? const EdgeInsets.all(16) : const EdgeInsets.fromLTRB(12, 12, 12, 12);
              final gap = wide ? 16.0 : 12.0;
              final panels = [
                Expanded(
                  child: _OrdersPanel(
                    title: t('pending'),
                    subtitle: t('pending_sub'),
                    badgeCount: pending.length,
                    accent: Colors.orange[700]!,
                    emptyText: t('no_pending'),
                    child: _OrdersList(
                      orders: pending,
                      itemBuilder: (order) {
                        final items = _filterItemsForSelectedCounter(order.items);
                        final key = _pendingCardKeys.putIfAbsent(order.id, () => GlobalKey());
                        return KeyedSubtree(
                          key: key,
                          child: CounterOrderCard(
                            order: order,
                            roomLabel: _roomLabel(order.roomId),
                            now: _now,
                            items: items,
                            itemToCategory: _menuItemToCategory,
                            displayCategoryForKey: _displayCategoryForKey,
                            displayNameForItem: _displayNameForInternal,
                            pendingTagText: t('pending_tag'),
                            completedTagText: t('completed_tag'),
                            elapsedLabel: t('elapsed'),
                            orderTimeLabel: t('order_time'),
                            completeLabel: t('complete'),
                            showCompleteButton: true,
                            onComplete: () {
                              _completeWithFlyAnimation(order: order, visibleItems: items, fromKey: key);
                            },
                          ),
                        );
                      },
                    ),
                  ),
                ),
                SizedBox(width: wide ? gap : 0, height: wide ? 0 : gap),
                Expanded(
                  child: _OrdersPanel(
                    key: _completedPanelKey,
                    title: t('completed'),
                    subtitle: t('completed_sub'),
                    badgeCount: completed.length,
                    accent: Colors.green[700]!,
                    emptyText: t('no_completed'),
                    child: _OrdersList(
                      orders: completed,
                      itemBuilder: (order) {
                        final items = _filterItemsForSelectedCounter(order.items);
                        return CounterOrderCard(
                          order: order,
                          roomLabel: _roomLabel(order.roomId),
                          now: _now,
                          items: items,
                          itemToCategory: _menuItemToCategory,
                          displayCategoryForKey: _displayCategoryForKey,
                          displayNameForItem: _displayNameForInternal,
                          pendingTagText: t('pending_tag'),
                          completedTagText: t('completed_tag'),
                          elapsedLabel: t('elapsed'),
                          orderTimeLabel: t('order_time'),
                          completeLabel: t('complete'),
                          showCompleteButton: false,
                        );
                      },
                    ),
                  ),
                ),
              ];

              return Padding(
                padding: pad,
                child: wide ? Row(children: panels) : Column(children: panels),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildCounterSelector() {
    final items = <DropdownMenuItem<String>>[
      DropdownMenuItem<String>(
        value: '',
        child: Text(t('all_counters')),
      ),
      ..._serviceCounters.map((c) {
        final id = (c['id'] ?? '').toString();
        final name = _counterNameById(id);
        return DropdownMenuItem<String>(
          value: id,
          child: Text(name, overflow: TextOverflow.ellipsis),
        );
      }),
    ];

    final selectedExists = items.any((e) => e.value == _selectedServiceCounterId);
    final value = selectedExists ? _selectedServiceCounterId : '';

    return SizedBox(
      width: 190,
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          isExpanded: true,
          value: value,
          items: items,
          onChanged: (v) {
            setState(() {
              _selectedServiceCounterId = v ?? '';
            });
          },
        ),
      ),
    );
  }

  Future<void> _openLockedSettings() async {
    if (_isApplyingConfig) return;

    final login = await _showAdminLoginDialog();
    if (login == null) return;

    final counters = await _fetchCountersForSettings(login.origin);
    if (!mounted) return;

    final savedCounter = _selectedServiceCounterId;
    final next = await _showCounterConfigDialog(
      initialHost: login.host,
      initialPort: login.port,
      counters: counters,
      initialCounterId: savedCounter,
    );
    if (next == null) return;

    await _applyCounterConfig(next);
  }

  Future<List<Map<String, dynamic>>> _fetchCountersForSettings(String origin) async {
    try {
      return await ApiService(originOverride: origin).fetchServiceCounters();
    } catch (_) {
      return [];
    }
  }

  Future<void> _applyCounterConfig(_CounterConfig next) async {
    final provider = context.read<OrderProvider>();
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
      await prefs.setBool('counter_locked', true);
      await prefs.setString('counter_service_counter_id', next.serviceCounterId);

      if (!mounted) return;
      setState(() {
        _isLocked = true;
        _isAdminView = false;
        _selectedServiceCounterId = next.serviceCounterId;
        _isLoadingMeta = true;
      });

      await provider.applyRuntimeConfigAndReconnect();
      await _loadMeta();
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
        return StatefulBuilder(builder: (context, setState) {
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
              final origin = useManual ? _originFromFields(ipCtrl.text, portCtrl.text) : null;
              final svc = ApiService(originOverride: origin);
              await svc.adminLogin(username: u, password: p);

              if (!context.mounted) return;
              final parsed = Uri.parse(origin ?? ApiService.socketUrl);
              Navigator.of(context).pop(
                _AdminLoginResult(
                  origin: origin ?? ApiService.socketUrl,
                  host: parsed.host,
                  port: parsed.hasPort ? parsed.port : (parsed.scheme == 'https' ? 443 : 80),
                ),
              );
            } catch (e) {
              final text = e.toString();
              if (!useManual && (text.contains('SocketException') || text.contains('TimeoutException'))) {
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
                      decoration: const InputDecoration(labelText: 'Server IP'),
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
                      child: Text(message!, style: TextStyle(color: Colors.red[700])),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: loading ? null : () => Navigator.of(context).pop(), child: const Text('取消')),
              ElevatedButton(
                onPressed: loading ? null : () => doLogin(useManual: showManual),
                child: loading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('登录'),
              ),
            ],
          );
        });
      },
    );

    usernameCtrl.dispose();
    passwordCtrl.dispose();
    ipCtrl.dispose();
    portCtrl.dispose();
    return result;
  }

  Future<_CounterConfig?> _showCounterConfigDialog({
    required String initialHost,
    required int initialPort,
    required List<Map<String, dynamic>> counters,
    required String initialCounterId,
  }) async {
    final hostCtrl = TextEditingController(text: initialHost);
    final portCtrl = TextEditingController(text: initialPort.toString());
    String selectedId = initialCounterId;

    if (!mounted) return null;
    final result = await showDialog<_CounterConfig>(
      context: context,
      builder: (context) {
        return StatefulBuilder(builder: (context, setState) {
          final items = counters.map((c) {
            final id = (c['id'] ?? '').toString();
            final base = (c['name'] ?? id).toString().trim();
            final zh = (c['nameZh'] ?? c['name_zh'] ?? '').toString().trim();
            final en = (c['nameEn'] ?? c['name_en'] ?? '').toString().trim();
            final hant = (c['nameHant'] ?? c['name_hant'] ?? '').toString().trim();
            final name = _langCode == 'en'
                ? (en.isNotEmpty ? en : (zh.isNotEmpty ? zh : (hant.isNotEmpty ? hant : base)))
                : (_langCode == 'zh-Hant'
                    ? (hant.isNotEmpty ? hant : (zh.isNotEmpty ? zh : (en.isNotEmpty ? en : base)))
                    : (zh.isNotEmpty ? zh : base));
            return DropdownMenuItem<String>(value: id, child: Text(name));
          }).toList();

          return AlertDialog(
            title: const Text('设备设置（Service Counter）'),
            content: SizedBox(
              width: 420,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(controller: hostCtrl, decoration: const InputDecoration(labelText: '服务器 IP')),
                  const SizedBox(height: 10),
                  TextField(controller: portCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '端口')),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: selectedId.isEmpty ? null : selectedId,
                    items: items,
                    onChanged: (v) => setState(() => selectedId = v ?? ''),
                    decoration: const InputDecoration(labelText: '绑定柜台'),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('取消')),
              ElevatedButton(
                onPressed: () {
                  final host = hostCtrl.text.trim();
                  final port = int.tryParse(portCtrl.text.trim()) ?? 0;
                  if (host.isEmpty || port <= 0) return;
                  if (selectedId.trim().isEmpty) return;
                  Navigator.of(context).pop(_CounterConfig(host: host, port: port, serviceCounterId: selectedId.trim()));
                },
                child: const Text('保存并锁定'),
              ),
            ],
          );
        });
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

  _AdminLoginResult({required this.origin, required this.host, required this.port});
}

class _CounterConfig {
  final String host;
  final int port;
  final String serviceCounterId;

  _CounterConfig({required this.host, required this.port, required this.serviceCounterId});
}

class _OrdersPanel extends StatelessWidget {
  final String title;
  final String subtitle;
  final int badgeCount;
  final Color accent;
  final String emptyText;
  final Widget child;

  const _OrdersPanel({
    super.key,
    required this.title,
    required this.subtitle,
    required this.badgeCount,
    required this.accent,
    required this.emptyText,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final bg = Colors.white;
    final border = Colors.grey.shade200;

    return Container(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                Container(
                  width: 4,
                  height: 22,
                  decoration: BoxDecoration(
                    color: accent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$badgeCount',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: accent,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              child: badgeCount == 0
                  ? Center(
                      child: Text(
                        emptyText,
                        style: TextStyle(color: Colors.grey[500], fontWeight: FontWeight.w600),
                      ),
                    )
                  : child,
            ),
          ),
        ],
      ),
    );
  }
}

class _OrdersList extends StatelessWidget {
  final List<Order> orders;
  final Widget Function(Order order) itemBuilder;

  const _OrdersList({required this.orders, required this.itemBuilder});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final singleColumn = constraints.maxWidth < 520;
        const spacing = 16.0;

        if (singleColumn) {
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
            itemCount: orders.length,
            separatorBuilder: (_, _) => const SizedBox(height: spacing),
            itemBuilder: (context, index) => itemBuilder(orders[index]),
          );
        }

        final rowCount = (orders.length / 2).ceil();
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
          itemCount: rowCount,
          separatorBuilder: (_, _) => const SizedBox(height: spacing),
          itemBuilder: (context, rowIndex) {
            final leftIndex = rowIndex * 2;
            final rightIndex = leftIndex + 1;

            final left = orders[leftIndex];
            final right = rightIndex < orders.length ? orders[rightIndex] : null;

            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: itemBuilder(left)),
                const SizedBox(width: spacing),
                Expanded(child: right == null ? const SizedBox.shrink() : itemBuilder(right)),
              ],
            );
          },
        );
      },
    );
  }
}

class CounterOrderCard extends StatelessWidget {
  final Order order;
  final String roomLabel;
  final DateTime now;
  final List<OrderItem> items;
  final Map<String, String> itemToCategory;
  final String Function(String categoryKey) displayCategoryForKey;
  final String Function(String internalName) displayNameForItem;
  final String pendingTagText;
  final String completedTagText;
  final String elapsedLabel;
  final String orderTimeLabel;
  final String completeLabel;
  final bool showCompleteButton;
  final VoidCallback? onComplete;
  final OrderStatus? forceStatus;

  const CounterOrderCard({
    super.key,
    required this.order,
    required this.roomLabel,
    required this.now,
    required this.items,
    required this.itemToCategory,
    required this.displayCategoryForKey,
    required this.displayNameForItem,
    required this.pendingTagText,
    required this.completedTagText,
    required this.elapsedLabel,
    required this.orderTimeLabel,
    required this.completeLabel,
    required this.showCompleteButton,
    this.onComplete,
    this.forceStatus,
  });

  String _formatElapsed(Duration d) {
    final totalSeconds = math.max(0, d.inSeconds);
    final hh = (totalSeconds ~/ 3600).toString().padLeft(2, '0');
    final mm = ((totalSeconds % 3600) ~/ 60).toString().padLeft(2, '0');
    final ss = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$hh:$mm:$ss';
  }

  @override
  Widget build(BuildContext context) {
    final status = forceStatus ?? order.status;
    final createdText = DateFormat('HH:mm:ss').format(order.createdAt);
    final elapsed = now.difference(order.createdAt);
    final elapsedText = _formatElapsed(elapsed);
    final overdue = elapsed.inSeconds >= 60;

    final border = Colors.grey.shade200;
    final bg = Colors.white;
    final titleColor = Colors.grey[900]!;
    final subtle = Colors.grey[600]!;

    final statusColor = status == OrderStatus.completed ? Colors.green[700]! : Colors.orange[700]!;

    return Container(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Icon(Icons.room, size: 26, color: Colors.blue[700]),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          roomLabel,
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: titleColor),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: statusColor.withValues(alpha: 0.25)),
                  ),
                  child: Text(
                    status == OrderStatus.completed ? completedTagText : pendingTagText,
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: statusColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (status != OrderStatus.completed) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: (overdue ? Colors.red[50] : Colors.blue[50])!,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: (overdue ? Colors.red[100] : Colors.blue[100])!),
                ),
                child: Row(
                  children: [
                    Icon(Icons.timer, size: 18, color: overdue ? Colors.red[700] : Colors.blue[700]),
                    const SizedBox(width: 8),
                    Text(
                      elapsedLabel,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: overdue ? Colors.red[900] : Colors.blue[900],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      elapsedText,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.4,
                        color: overdue ? Colors.red[900] : Colors.blue[900],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
            ...items.map((item) {
              final category = (itemToCategory[item.name.trim()] ?? '').trim();
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 2),
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: Colors.grey[600],
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Row(
                        children: [
                          if (category.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.grey[100],
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: Colors.grey[200]!),
                              ),
                              child: Text(
                                displayCategoryForKey(category),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.grey[800],
                                ),
                              ),
                            ),
                          if (category.isNotEmpty) const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '${displayNameForItem(item.name)} x${item.qty}',
                              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: titleColor),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.schedule, size: 20, color: subtle),
                const SizedBox(width: 6),
                Text(
                  '$orderTimeLabel $createdText',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: subtle),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    order.id,
                    style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (showCompleteButton)
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.green[700],
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: onComplete,
                    icon: const Icon(Icons.check, size: 24),
                    label: Text(completeLabel, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
