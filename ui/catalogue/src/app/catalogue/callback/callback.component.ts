import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  template: `<div class="book-detail-loading">Signing in…</div>`,
})
export class CallbackComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
    try {
      const returnUrl = this.auth.handleCallback(window.location.hash);
      this.router.navigateByUrl(returnUrl, { replaceUrl: true });
    } catch {
      this.router.navigate(['/'], { replaceUrl: true });
    }
  }
}
