import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { CategoryService, CategoryNode } from '../../services/category.service';
import { decodeJwtPayload } from '../../utils/jwt';

@Component({
  selector: 'app-add-product',
  templateUrl: './add-product.component.html',
  styleUrls: ['./add-product.component.css']
})
export class AddProductComponent implements OnInit {
  name = '';
  description = '';
  price: number | null = null;
  category = '';
  imageUrl = '';
  imageUrls: string[] = [];
  condition = '';
  submitting = false;

  // Populated when the backend rejects the insert because the org is at
  // its plan's listing cap. The form shows an inline banner with a
  // "View plans" deep-link to /dashboard/plan.
  limitMessage: string | null = null;

  // Cascading category picker — top-level choice drives the subcategory
  // list. When a subcategory is chosen, we submit both category_id (leaf)
  // and category (leaf name) to keep back-compat with text filters.
  categoryTree: CategoryNode[] = [];
  selectedTopId: string | null = null;
  selectedSubId: string | null = null;

  conditions = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

  constructor(
    private productService: ProductService,
    private router: Router,
    private toastService: ToastService,
    private categoryService: CategoryService,
  ) {}

  ngOnInit(): void {
    this.categoryService.getTree().subscribe({
      next: (tree) => { this.categoryTree = tree ?? []; },
      error: () => { this.categoryTree = []; },
    });
  }

  get topCategory(): CategoryNode | null {
    return this.selectedTopId
      ? (this.categoryTree.find(c => c._id === this.selectedTopId) ?? null)
      : null;
  }

  get subCategories(): CategoryNode[] {
    return this.topCategory?.children ?? [];
  }

  onTopCategoryChange(): void {
    // Reset the sub-selection whenever the top-level changes so we don't
    // leave a stale leaf id paired with a different parent.
    this.selectedSubId = null;
    this.syncCategoryFields();
  }

  onSubCategoryChange(): void { this.syncCategoryFields(); }

  // Keep the text `category` mirror in sync with whichever leaf is picked
  // (sub wins; top is the fallback). This preserves the legacy filter.
  private syncCategoryFields(): void {
    const top = this.topCategory;
    const sub = this.selectedSubId
      ? (this.subCategories.find(c => c._id === this.selectedSubId) ?? null)
      : null;
    if (sub) { this.category = sub.name; return; }
    if (top) { this.category = top.name; return; }
    this.category = '';
  }

  private selectedLeafId(): string | null {
    return this.selectedSubId ?? this.selectedTopId ?? null;
  }

  onPhotoUploaded(url: string): void {
    if (!this.imageUrl) {
      this.imageUrl = url;
    } else {
      this.imageUrls.push(url);
    }
  }

  addPhotoSlot(): void {
    this.imageUrls.push('');
  }

  removePhoto(index: number): void {
    this.imageUrls.splice(index, 1);
  }

  trackByIndex(index: number): number { return index; }

  addProduct() {
    if (!this.name || !this.description || !this.price || !this.category || !this.imageUrl) {
      this.toastService.error('Please fill in all fields.');
      return;
    }
    this.submitting = true;
    this.limitMessage = null;
    const product: any = {
      name: this.name,
      description: this.description,
      price: this.price,
      category: this.category,
      imageUrl: this.imageUrl,
      imageUrls: this.imageUrls.filter(u => u),
    };
    const leafId = this.selectedLeafId();
    if (leafId) product.categoryId = leafId;
    if (this.condition) product.condition = this.condition;
    this.productService.createProduct(product).subscribe({
      next: () => {
        // Backend derives org_id from the user's current JWT claim, so we
        // route + toast by the same signal here.
        const payload = decodeJwtPayload<{ currentOrgId?: string | null }>(localStorage.getItem('token'));
        const isPro = !!payload?.currentOrgId;
        if (isPro) {
          this.toastService.success('Listing posted to Pro catalog');
          this.router.navigate(['/dashboard/catalog']);
        } else {
          this.toastService.success('Listing posted to Marketplace');
          this.router.navigate(['/marketplace']);
        }
      },
      error: (err: any) => {
        const extra = err?.error?.extra;
        if (err?.status === 403 && extra?.code === 'LISTING_LIMIT_REACHED') {
          const limit = typeof extra.limit === 'number' ? extra.limit : 10;
          this.limitMessage =
            `You've reached the ${limit}-listing limit on the Free plan. Upgrade to Pro to continue.`;
          this.toastService.error(this.limitMessage);
        } else {
          this.toastService.error(err.error?.message ?? 'Failed to add product.');
        }
        this.submitting = false;
      }
    });
  }
}
