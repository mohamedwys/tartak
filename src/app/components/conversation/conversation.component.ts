import { Component, OnInit, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from '../../services/message.service';
import { ProductService } from '../../services/product.service';
import { OfferService } from '../../services/offer.service';
import { AuthService } from '../../services/auth.service';
import { decodeJwtPayload } from '../../utils/jwt';

@Component({
  selector: 'app-conversation',
  templateUrl: './conversation.component.html',
  styleUrls: ['./conversation.component.css']
})
export class ConversationComponent implements OnInit, AfterViewChecked {
  @ViewChild('messageList') messageListRef!: ElementRef;

  messages: any[] = [];
  product: any = null;
  otherUserId = '';
  productId = '';
  content = '';
  sending = false;
  loading = true;
  error = '';
  myId = '';
  private shouldScroll = false;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private messageService: MessageService,
    private productService: ProductService,
    private offerService: OfferService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) { this.router.navigate(['/login']); return; }
    this.myId = this.getMyId();
    this.route.params.subscribe(params => {
      this.otherUserId = params['userId'];
      this.productId = params['productId'];
      this.loadAll();
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private loadAll(): void {
    this.loading = true;
    this.productService.getProductById(this.productId).subscribe({
      next: (p) => { this.product = p; },
      error: () => {}
    });
    this.messageService.getConversation(this.otherUserId, this.productId).subscribe({
      next: (msgs) => {
        this.messages = msgs;
        this.loading = false;
        this.shouldScroll = true;
        // Mark as read — fire and forget
        this.messageService.markConversationRead(this.otherUserId, this.productId)
          .subscribe({ next: () => {}, error: () => {} });
      },
      error: () => { this.error = 'Could not load conversation.'; this.loading = false; }
    });
  }

  send(): void {
    if (!this.content.trim() || this.sending) return;
    this.sending = true;
    this.messageService.sendMessage({
      recipientId: this.otherUserId,
      productId: this.productId,
      content: this.content.trim()
    }).subscribe({
      next: (msg) => {
        this.messages.push(msg);
        this.content = '';
        this.sending = false;
        this.shouldScroll = true;
      },
      error: () => { this.sending = false; }
    });
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  /** True if this message is an offer and the current user is the seller (recipient) */
  canRespondToOffer(msg: any): boolean {
    if (msg.type !== 'offer' || !msg.offerRef) return false;
    if (msg.offerRef.status !== 'pending') return false;
    // The seller is the recipient of the offer message
    const senderId = msg.senderId?._id ?? msg.senderId;
    return senderId !== this.myId;
  }

  respondToOffer(msg: any, status: 'accepted' | 'declined'): void {
    const offerId = msg.offerRef._id ?? msg.offerRef;
    this.offerService.respond(offerId, status).subscribe({
      next: (updated) => {
        msg.offerRef.status = updated.status;
        // Add the seller's reply message to the thread
        const replyContent = status === 'accepted'
          ? `Offer accepted! ($${msg.offerRef.amount})`
          : `Offer declined. ($${msg.offerRef.amount})`;
        this.messages.push({ content: replyContent, senderId: this.myId, createdAt: new Date().toISOString(), type: 'text' });
        this.shouldScroll = true;
      },
      error: () => {}
    });
  }

  isMine(msg: any): boolean {
    const senderId = msg.senderId?._id ?? msg.senderId;
    return senderId === this.myId;
  }

  private getMyId(): string {
    return decodeJwtPayload<{ id?: string }>(localStorage.getItem('token'))?.id ?? '';
  }

  private scrollToBottom(): void {
    const el = this.messageListRef?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
