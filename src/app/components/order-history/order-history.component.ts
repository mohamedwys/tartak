import { Component, OnInit } from '@angular/core';
import { OrderService } from '../../services/order.service';

@Component({
  selector: 'app-order-history',
  templateUrl: './order-history.component.html',
  styleUrls: ['./order-history.component.css']
})
export class OrderHistoryComponent implements OnInit {
  orders: any[] = [];
  loading = true;
  error = '';

  constructor(private orderService: OrderService) {}

  ngOnInit() {
    this.orderService.getOrders().subscribe({
      next: (orders) => { this.orders = orders; this.loading = false; },
      error: () => { this.error = 'Failed to load orders.'; this.loading = false; }
    });
  }

  shortId(id: string): string { return id.slice(-6).toUpperCase(); }
}
