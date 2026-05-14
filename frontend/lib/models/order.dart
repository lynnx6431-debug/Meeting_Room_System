class OrderItem {
  final String name;
  final int qty;

  OrderItem({required this.name, required this.qty});

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'qty': qty,
    };
  }

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      name: json['name'] as String,
      qty: json['qty'] as int,
    );
  }
}

enum OrderStatus { pending, completed }

class Order {
  final String id;
  final String roomId;
  final List<OrderItem> items;
  final OrderStatus status;
  final bool aiReadyFlag;
  final DateTime createdAt;
  final DateTime? updatedAt;

  Order({
    required this.id,
    required this.roomId,
    required this.items,
    required this.status,
    required this.aiReadyFlag,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'] as String,
      roomId: json['roomId'] as String,
      items: (json['items'] as List<dynamic>)
          .map((item) => OrderItem.fromJson(item as Map<String, dynamic>))
          .toList(),
      status: OrderStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => OrderStatus.pending,
      ),
      aiReadyFlag: (json['aiReadyFlag'] as bool?) ?? (json['ai_ready_flag'] as bool?) ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      updatedAt: json['updatedAt'] != null ? DateTime.parse(json['updatedAt'] as String).toLocal() : null,
    );
  }
}
