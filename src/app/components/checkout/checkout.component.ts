import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent {
  fullName = '';
  street = '';
  city = '';
  postalCode = '';
  error = '';
  submitting = false;

  constructor(
    private cartService: CartService,
    private orderService: OrderService,
    private router: Router
  ) {}

  get total() { return this.cartService.getTotal(); }
  get cartItems() { return this.cartService.getItems(); }

  placeOrder() {
    if (!this.fullName || !this.street || !this.city || !this.postalCode) {
      this.error = 'Please fill in all fields.'; return;
    }
    this.submitting = true;
    const data = {
      items: this.cartItems.map(i => ({
        productId: i._id, name: i.name, price: i.price,
        quantity: i.quantity, imageUrl: i.imageUrl,
      })),
      total: this.total,
      shippingAddress: { fullName: this.fullName, street: this.street, city: this.city, postalCode: this.postalCode },
    };
    this.orderService.createOrder(data).subscribe({
      next: (order) => { this.submitting = false; this.cartService.clearCart(); this.router.navigate(['/order-confirmation', order._id]); },
      error: (err) => { this.error = err.error?.message ?? 'Failed to place order.'; this.submitting = false; }
    });
  }
}
