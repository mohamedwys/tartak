import { Component, OnInit } from '@angular/core';
import { CartService, CartItem } from '../../services/cart.service';
import { ProductService } from '../../services/product.service';
import { ToastService } from '../../services/toast.service';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent implements OnInit {
  constructor(
    public cartService: CartService,
    private productService: ProductService,
    private toastService: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.dropMarketplaceItems();
  }

  // Cart is Pro-only. If a Marketplace listing somehow lands here (e.g. a
  // product that lost its org_id), drop it silently and notify once.
  private dropMarketplaceItems(): void {
    const items = this.cartService.getItems();
    if (items.length === 0) return;
    const lookups = items.map((item) =>
      this.productService.getProductById(item._id).pipe(catchError(() => of(null)))
    );
    forkJoin(lookups).subscribe((results) => {
      const toDrop: CartItem[] = [];
      results.forEach((p, i) => {
        // If the product no longer exists, leave it alone (another code path
        // handles stale cart items). If it exists and has no org, drop it.
        if (p && !p.orgId && !p.org) toDrop.push(items[i]);
      });
      if (toDrop.length > 0) {
        toDrop.forEach((it) => this.cartService.removeFromCart(it));
        this.toastService.info("Marketplace items can't be added to cart");
      }
    });
  }

  get cartItems(): CartItem[] { return this.cartService.getItems(); }
  get total(): number { return this.cartService.getTotal(); }

  increment(item: CartItem) { this.cartService.updateQuantity(item._id, item.quantity + 1); }
  decrement(item: CartItem) { this.cartService.updateQuantity(item._id, item.quantity - 1); }
  remove(item: CartItem) { this.cartService.removeFromCart(item); }
  checkout() { this.router.navigate(['/checkout']); }
}
