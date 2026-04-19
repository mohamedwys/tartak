import { Component } from '@angular/core';
import { CartService, CartItem } from '../../services/cart.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent {
  constructor(public cartService: CartService, private router: Router) {}

  get cartItems(): CartItem[] { return this.cartService.getItems(); }
  get total(): number { return this.cartService.getTotal(); }

  increment(item: CartItem) { this.cartService.updateQuantity(item._id, item.quantity + 1); }
  decrement(item: CartItem) { this.cartService.updateQuantity(item._id, item.quantity - 1); }
  remove(item: CartItem) { this.cartService.removeFromCart(item); }
  checkout() { this.router.navigate(['/checkout']); }
}
