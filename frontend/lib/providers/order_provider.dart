import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../models/order.dart';
import '../services/api_service.dart';

class OrderProvider extends ChangeNotifier {
  ApiService _apiService = ApiService();
  io.Socket? _socket;
  List<Order> _orders = [];
  bool _isConnected = false;

  List<Order> get orders => _orders;
  bool get isConnected => _isConnected;

  OrderProvider() {
    _initSocket();
    fetchOrders();
  }

  void _initSocket() {
    _socket?.disconnect();
    _socket?.dispose();

    final socket = io.io(ApiService.socketUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'auth': {'apiKey': ApiService.apiKey},
    });

    _socket = socket;
    socket.connect();

    socket.on('connect', (_) {
      _isConnected = true;
      notifyListeners();
    });

    socket.on('disconnect', (_) {
      _isConnected = false;
      notifyListeners();
    });

    socket.on('new_order', (data) {
      final order = Order.fromJson(data);
      _orders.insert(0, order);
      notifyListeners();
    });

    socket.on('order_updated', (data) {
      final updatedOrder = Order.fromJson(data);
      final index = _orders.indexWhere((o) => o.id == updatedOrder.id);
      if (index != -1) {
        _orders[index] = updatedOrder;
        notifyListeners();
      }
    });
  }

  Future<void> fetchOrders() async {
    try {
      _orders = await _apiService.fetchOrders();
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching orders: $e');
    }
  }

  Future<Order?> createOrder(String roomId, List<OrderItem> items) async {
    try {
      final order = await _apiService.createOrder(roomId, items);
      return order;
    } catch (e) {
      debugPrint('Error creating order: $e');
      return null;
    }
  }

  Future<void> updateOrderStatus(String orderId, OrderStatus status) async {
    try {
      await _apiService.updateOrderStatus(orderId, status);
    } catch (e) {
      debugPrint('Error updating order: $e');
    }
  }

  Future<bool> tryUpdateOrderStatus(String orderId, OrderStatus status) async {
    try {
      await _apiService.updateOrderStatus(orderId, status);
      return true;
    } catch (e) {
      debugPrint('Error updating order: $e');
      return false;
    }
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _socket?.dispose();
    super.dispose();
  }

  Future<void> applyRuntimeConfigAndReconnect() async {
    _apiService = ApiService();
    _initSocket();
    await fetchOrders();
  }
}
