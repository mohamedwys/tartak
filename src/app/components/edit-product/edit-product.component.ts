import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-edit-product',
  templateUrl: './edit-product.component.html',
  styleUrls: ['./edit-product.component.css']
})
export class EditProductComponent implements OnInit {
  product: any = {};
  error = '';
  submitting = false;
  categories = ['Electronics', 'Furniture', 'Clothing', 'Sports', 'Music', 'Photography', 'Home & Garden'];
  conditions = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

  constructor(
    private productService: ProductService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.productService.getProductById(id).subscribe({
        next: (data) => { this.product = data; },
        error: (err: any) => { this.error = err.error?.message ?? 'Failed to load product.'; }
      });
    }
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
