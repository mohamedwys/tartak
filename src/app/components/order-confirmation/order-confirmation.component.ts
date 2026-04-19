import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-order-confirmation',
  templateUrl: './order-confirmation.component.html',
  styleUrls: ['./order-confirmation.component.css']
})
export class OrderConfirmationComponent implements OnInit {
  orderId = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit() { this.orderId = this.route.snapshot.paramMap.get('id') ?? ''; }

  shortId(): string { return this.orderId.slice(-6).toUpperCase(); }
}
