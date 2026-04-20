import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { HomeService, Tile } from '../../services/home.service';

@Component({
  selector: 'app-home-tiles',
  templateUrl: './home-tiles.component.html',
  styleUrls: ['./home-tiles.component.css'],
})
export class HomeTilesComponent implements OnInit {
  tiles: Tile[] = [];
  loading = true;

  constructor(
    private home: HomeService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.home.getHome().subscribe({
      next: (res) => {
        this.tiles = res.tiles ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.tiles = [];
        this.loading = false;
      },
    });
  }

  initial(tile: Tile): string {
    return (tile.label || '?').trim().charAt(0).toUpperCase();
  }

  openTile(tile: Tile): void {
    if (!tile?.targetUrl) return;
    if (/^https?:\/\//i.test(tile.targetUrl)) {
      window.location.href = tile.targetUrl;
    } else {
      this.router.navigateByUrl(tile.targetUrl);
    }
  }

  trackById(_: number, t: Tile): string { return t._id; }
}
