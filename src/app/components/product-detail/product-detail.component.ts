import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { MessageService } from '../../services/message.service';
import { FavoriteService } from '../../services/favorite.service';
import { OfferService } from '../../services/offer.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ReportService } from '../../services/report.service';
import { CartService } from '../../services/cart.service';
import { decodeJwtPayload } from '../../utils/jwt';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnInit {
  product: any = null;
  seller: any = null;
  otherListings: any[] = [];
  similarListings: any[] = [];
  loading = true;
  error = '';
  isOwn = false;
  isLoggedIn = false;

  // Message
  showMessageForm = false;
  messageContent = '';
  sendingMessage = false;
  messageSent = false;
  messageError = '';

  // Carousel
  activePhotoIndex = 0;

  get photos(): string[] {
    if (!this.product) return [];
    const all = [this.product.imageUrl, ...(this.product.imageUrls ?? [])].filter(Boolean);
    return [...new Set(all)];
  }

  prevPhoto(): void {
    this.activePhotoIndex = (this.activePhotoIndex - 1 + this.photos.length) % this.photos.length;
  }

  nextPhoto(): void {
    this.activePhotoIndex = (this.activePhotoIndex + 1) % this.photos.length;
  }

  setPhoto(i: number): void {
    this.activePhotoIndex = i;
  }

  // Favorite
  isFavorited = false;
  togglingFav = false;

  // Offer
  showOfferForm = false;
  offerAmount: number | null = null;
  offerMessage = '';
  sendingOffer = false;
  offerError = '';

  // Report
  showReportModal = false;
  reportReason = 'spam';
  reportReasons = [
    { value: 'spam', label: 'Spam or misleading' },
    { value: 'prohibited', label: 'Prohibited item' },
    { value: 'counterfeit', label: 'Counterfeit goods' },
    { value: 'other', label: 'Other' },
  ];
  submittingReport = false;
  reportDone = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private messageService: MessageService,
    private favoriteService: FavoriteService,
    private offerService: OfferService,
    private authService: AuthService,
    private toastService: ToastService,
    private reportService: ReportService,
    private cartService: CartService,
  ) {}

  // Pro products have an org_id → part of a business catalog.
  // Marketplace products are individual (C2C) listings.
  isProProduct(): boolean { return !!this.product?.org?._id || !!this.product?.org?.id || !!this.product?.orgId; }
  isMarketplaceProduct(): boolean { return !!this.product && !this.isProProduct(); }

  modeLabel(): string { return this.isProProduct() ? 'Pro' : 'Marketplace'; }
  modePath(): string { return this.isProProduct() ? '/' : '/marketplace'; }

  addToCart(): void {
    if (!this.product) return;
    this.cartService.addItem({
      _id: this.product._id,
      name: this.product.name,
      price: this.product.price,
      imageUrl: this.product.imageUrl,
    });
    this.toastService.success('Added to cart');
  }

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.route.params.subscribe(params => this.loadProduct(params['id']));
  }

  private loadProduct(id: string): void {
    this.loading = true;
    this.product = null;
    this.seller = null;
    this.otherListings = [];
    this.similarListings = [];
    this.messageSent = false;
    this.showMessageForm = false;
    this.showOfferForm = false;
    this.isFavorited = false;
    this.activePhotoIndex = 0;
    this.error = '';
    this.showReportModal = false;
    this.reportDone = false;

    this.productService.getProductById(id).subscribe({
      next: (product) => {
        this.product = product;
        this.seller = product.ownerId;
        this.loading = false;
        this.checkOwnership();
        this.loadOtherListings();
        this.loadSimilarListings();
        if (this.isLoggedIn) {
          this.checkFavorited();
        }
      },
      error: () => { this.error = 'Listing not found.'; this.loading = false; }
    });
  }

  private checkOwnership(): void {
    const payload = decodeJwtPayload<{ id?: string }>(localStorage.getItem('token'));
    this.isOwn = !!payload && !!this.seller && this.seller._id === payload.id;
  }

  private checkFavorited(): void {
    this.favoriteService.getFavoriteIds().subscribe({
      next: (ids) => { this.isFavorited = ids.includes(this.product._id); },
      error: () => {}
    });
  }

  private loadOtherListings(): void {
    if (!this.seller?._id) return;
    this.productService.getProductsByOwner(this.seller._id).subscribe({
      next: (res) => {
        this.otherListings = res.products.filter((p: any) => p._id !== this.product._id).slice(0, 6);
      },
      error: () => {}
    });
  }

  private loadSimilarListings(): void {
    this.productService.getSimilarProducts(this.product._id).subscribe({
      next: (items) => { this.similarListings = items; },
      error: () => {}
    });
  }

  // Favorite
  toggleFavorite(): void {
    if (!this.isLoggedIn) { this.router.navigate(['/login']); return; }
    this.togglingFav = true;
    this.favoriteService.toggle(this.product._id).subscribe({
      next: (res) => { this.isFavorited = res.favorited; this.togglingFav = false; },
      error: () => { this.togglingFav = false; }
    });
  }

  // Message
  openMessage(): void {
    if (!this.isLoggedIn) { this.router.navigate(['/login']); return; }
    this.showMessageForm = true;
    this.showOfferForm = false;
    this.messageContent = '';
    this.messageError = '';
  }

  cancelMessage(): void {
    this.showMessageForm = false;
    this.messageContent = '';
    this.messageError = '';
  }

  sendMessage(): void {
    if (!this.messageContent.trim()) { this.messageError = 'Message cannot be empty.'; return; }
    this.sendingMessage = true;
    this.messageError = '';
    this.messageService.sendMessage({
      recipientId: this.seller._id,
      productId: this.product._id,
      content: this.messageContent.trim(),
    }).subscribe({
      next: () => {
        this.messageSent = true;
        this.sendingMessage = false;
        this.showMessageForm = false;
      },
      error: (err) => {
        this.messageError = err.error?.message ?? 'Failed to send.';
        this.sendingMessage = false;
      }
    });
  }

  // Offer
  openOffer(): void {
    if (!this.isLoggedIn) { this.router.navigate(['/login']); return; }
    this.showOfferForm = true;
    this.showMessageForm = false;
    this.offerAmount = null;
    this.offerMessage = '';
    this.offerError = '';
  }

  cancelOffer(): void {
    this.showOfferForm = false;
    this.offerAmount = null;
    this.offerMessage = '';
    this.offerError = '';
  }

  sendOffer(): void {
    if (!this.offerAmount || this.offerAmount <= 0) {
      this.offerError = 'Please enter a valid amount.'; return;
    }
    this.sendingOffer = true;
    this.offerError = '';
    this.offerService.makeOffer({
      productId: this.product._id,
      amount: this.offerAmount,
      message: this.offerMessage || undefined,
    }).subscribe({
      next: () => {
        this.sendingOffer = false;
        // Navigate to the conversation where the offer message now lives
        this.router.navigate(['/conversation', this.seller._id, this.product._id]);
      },
      error: (err) => {
        this.offerError = err.error?.message ?? 'Failed to send offer.';
        this.sendingOffer = false;
      }
    });
  }

  // Report
  openReport(): void {
    this.showReportModal = true;
    this.reportReason = 'spam';
    this.reportDone = false;
  }

  closeReport(): void {
    this.showReportModal = false;
  }

  submitReport(): void {
    if (this.submittingReport) return;
    this.submittingReport = true;
    this.reportService.reportProduct({ productId: this.product._id, reason: this.reportReason }).subscribe({
      next: () => { this.reportDone = true; this.submittingReport = false; },
      error: (err: any) => {
        // 409 = already reported — treat as success message
        if (err.status === 409) { this.reportDone = true; }
        this.submittingReport = false;
      }
    });
  }

  openSellerProfile(): void {
    if (this.seller?._id) this.router.navigate(['/seller', this.seller._id]);
  }

  deleteListing(): void {
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    this.productService.deleteProduct(this.product._id).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => alert('Failed to delete listing.')
    });
  }

  markAsSold(): void {
    if (!confirm('Mark this listing as sold?')) return;
    this.productService.markAsSold(this.product._id).subscribe({
      next: (updated) => { this.product = updated; },
      error: () => {}
    });
  }

  shareLink(): void {
    navigator.clipboard.writeText(window.location.href).then(() => {
      this.toastService.success('Link copied!');
    }).catch(() => {
      this.toastService.error('Could not copy link.');
    });
  }

  get sellerInitials(): string {
    if (!this.seller?.name) return '?';
    return this.seller.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  }

  get sellerFirstName(): string {
    return this.seller?.name?.split(' ')[0] ?? 'Seller';
  }
}
