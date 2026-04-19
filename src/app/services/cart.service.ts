import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CartItem {
  _id: string;
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly KEY = 'cart';
  private countSubject = new BehaviorSubject<number>(this._getCount());
  count$ = this.countSubject.asObservable();

  private load(): CartItem[] {
    try { return JSON.parse(localStorage.getItem(this.KEY) ?? '[]'); }
    catch { return []; }
  }

  private persist(items: CartItem[]) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
    this.countSubject.next(items.reduce((s, i) => s + i.quantity, 0));
  }

  private _getCount(): number {
    return this.load().reduce((s, i) => s + i.quantity, 0);
  }

  getItems(): CartItem[] { return this.load(); }

  getCart(): CartItem[] { return this.load(); }

  addItem(product: { _id: string; name: string; price: number; imageUrl: string }) {
    const items = this.load();
    const existing = items.find(i => i._id === product._id);
    if (existing) { existing.quantity += 1; }
    else { items.push({ ...product, quantity: 1 }); }
    this.persist(items);
  }

  removeFromCart(item: { _id: string }) {
    this.persist(this.load().filter(i => i._id !== item._id));
  }

  updateQuantity(id: string, qty: number) {
    if (qty <= 0) { this.removeFromCart({ _id: id }); return; }
    const items = this.load();
    const item = items.find(i => i._id === id);
    if (item) { item.quantity = qty; this.persist(items); }
  }

  getTotal(): number {
    return this.load().reduce((s, i) => s + i.price * i.quantity, 0);
  }

  getCount(): number { return this._getCount(); }

  clearCart() {
    localStorage.removeItem(this.KEY);
    this.countSubject.next(0);
  }
}
