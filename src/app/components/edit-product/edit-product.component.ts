import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CategoryService, CategoryNode } from '../../services/category.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-edit-product',
  templateUrl: './edit-product.component.html',
  styleUrls: ['./edit-product.component.css']
})
export class EditProductComponent implements OnInit {
  product: any = {};
  error = '';
  submitting = false;
  conditions = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

  categoryTree: CategoryNode[] = [];
  selectedTopId: string | null = null;
  selectedSubId: string | null = null;
  // Legacy products without a backfilled category_id fall into this state.
  // We surface the old text + a "Pick from categories" link to move them
  // onto the new taxonomy without forcing a destructive edit.
  showLegacyCategoryHint = false;

  constructor(
    private productService: ProductService,
    private route: ActivatedRoute,
    private router: Router,
    private categoryService: CategoryService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    forkJoin({
      product: this.productService.getProductById(id),
      tree: this.categoryService.getTree(),
    }).subscribe({
      next: ({ product, tree }) => {
        this.product = product;
        this.categoryTree = tree ?? [];
        this.hydrateCategorySelection();
      },
      error: (err: any) => {
        this.error = err.error?.message ?? 'Failed to load product.';
      },
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
    this.selectedSubId = null;
    this.syncCategoryFields();
  }

  onSubCategoryChange(): void { this.syncCategoryFields(); }

  private syncCategoryFields(): void {
    const top = this.topCategory;
    const sub = this.selectedSubId
      ? (this.subCategories.find(c => c._id === this.selectedSubId) ?? null)
      : null;
    const leaf = sub ?? top;
    this.product.category = leaf ? leaf.name : '';
    this.product.categoryId = leaf ? leaf._id : null;
  }

  // Pre-fill dropdowns from categoryId (preferred) or fall back to legacy
  // text category (hint mode). Handles both top-level and sub-level ids.
  private hydrateCategorySelection(): void {
    const catId = this.product?.categoryId;
    if (catId) {
      this.showLegacyCategoryHint = false;
      const topMatch = this.categoryTree.find(c => c._id === catId);
      if (topMatch) { this.selectedTopId = topMatch._id; this.selectedSubId = null; return; }
      for (const top of this.categoryTree) {
        const sub = top.children?.find(c => c._id === catId);
        if (sub) { this.selectedTopId = top._id; this.selectedSubId = sub._id; return; }
      }
      return;
    }
    // No categoryId — surface the legacy text as a read-only hint.
    this.showLegacyCategoryHint = !!this.product?.category;
  }

  unlockCategoryPicker(): void {
    this.showLegacyCategoryHint = false;
  }

  addPhotoSlot(): void {
    if (!this.product.imageUrls) this.product.imageUrls = [];
    this.product.imageUrls.push('');
  }

  removePhoto(index: number): void {
    if (!this.product.imageUrls) return;
    this.product.imageUrls.splice(index, 1);
  }

  trackByIndex(index: number): number { return index; }

  editProduct() {
    this.submitting = true;
    this.error = '';
    this.productService.updateProduct(this.product._id, this.product).subscribe({
      next: () => { this.router.navigate(['/']); },
      error: (err: any) => {
        this.error = err.error?.message ?? 'Failed to update product.';
        this.submitting = false;
      }
    });
  }
}
