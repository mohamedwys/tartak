import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { UploadService } from '../../services/upload.service';

@Component({
  selector: 'app-image-upload',
  templateUrl: './image-upload.component.html',
  styleUrls: ['./image-upload.component.css']
})
export class ImageUploadComponent implements OnInit, OnDestroy {
  @Input() currentUrl?: string;
  @Output() uploaded = new EventEmitter<string>();

  previewUrl: string | null = null;
  isDragOver = false;
  uploading = false;
  uploadError = '';
  private uploadSub?: Subscription;

  constructor(private uploadService: UploadService) {}

  ngOnInit(): void {
    if (this.currentUrl) {
      this.previewUrl = this.currentUrl;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadFile(input.files[0]);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.uploadFile(event.dataTransfer.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  uploadFile(file: File): void {
    this.uploadError = '';

    if (!file.type.startsWith('image/')) {
      this.uploadError = 'Only image files are allowed.';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.uploadError = 'Image must be 5MB or smaller.';
      return;
    }

    this.uploading = true;
    this.uploadSub = this.uploadService.uploadImage(file).subscribe({
      next: (response) => {
        this.previewUrl = response.url;
        this.uploading = false;
        this.uploaded.emit(response.url);
      },
      error: (err) => {
        this.uploading = false;
        this.uploadError = err?.error?.message ?? 'Upload failed. Please try again.';
      }
    });
  }

  ngOnDestroy(): void {
    this.uploadSub?.unsubscribe();
  }
}
