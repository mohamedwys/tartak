import { Component } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { decodeJwtPayload } from '../../utils/jwt';

@Component({
  selector: 'app-add-product',
  templateUrl: './add-product.component.html',
  styleUrls: ['./add-product.component.css']
})
export class AddProductComponent {
  name = '';
  description = '';
  price: number | null = null;
  category = '';
  imageUrl = '';
  imageUrls: string[] = [];
  condition = '';
  submitting = false;

  categories = ['Electronics', 'Furniture', 'Clothing', 'Sports', 'Music', 'Photography', 'Home & Garden'];
  conditions = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

  constructor(private productService: ProductService, private router: Router, private toastService: ToastService) {}

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
    const product: any = {
      name: this.name,
      description: this.description,
      price: this.price,
      category: this.category,
      imageUrl: this.imageUrl,
      imageUrls: this.imageUrls.filter(u => u),
    };
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
        this.toastService.error(err.error?.message ?? 'Failed to add product.');
        this.submitting = false;
      }
    });
  }
}
