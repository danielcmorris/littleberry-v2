import { Component, input, computed, inject } from '@angular/core';
import { workPath } from '../../core/slugify';
import { RouterLink } from '@angular/router';
import { Book } from '../../core/book.model';
import { LangService } from '../../core/lang.service';
import { I18N } from '../../core/i18n.tokens';
import { CoverComponent } from '../cover/cover.component';

@Component({
  selector: 'app-book-card',
  standalone: true,
  imports: [CoverComponent, RouterLink],
  template: `
    <button [class]="'bookcard bookcard--' + size()" [routerLink]="bookRoute()" [queryParams]="queryParams()">
      <div class="bookcard-cover">
        <app-cover [book]="book()" />
        @if (isNew()) {
          <span class="bookcard-newbadge">{{ i18n()['new_label'] }}</span>
        }
        @if (book().digital_copies.length > 0) {
          <span class="bookcard-digital" title="Digital copy available">&#x2B07;</span>
        }
      </div>
      <div class="bookcard-meta">
        <div class="bookcard-call">{{ book().call_number }}</div>
        <div class="bookcard-title">{{ book().title }}</div>
        <div class="bookcard-author">{{ book().author }}</div>
        @if (book().year) {
          <div class="bookcard-year">{{ book().year }}</div>
        }
      </div>
    </button>
  `,
})
export class BookCardComponent {
  book = input.required<Book>();
  size = input<string>('md');
  queryParams = input<Record<string, string> | null>(null);

  private langSvc = inject(LangService);
  i18n = computed(() => I18N[this.langSvc.lang()] ?? I18N['en']);

  bookRoute = computed(() => {
    const b = this.book();
    return b.seq_id ? ['/', workPath(b.seq_id, b.title)] : ['/', b.call_number];
  });

  isNew(): boolean {
    return (this.book().book_id ?? 0) >= 12000;
  }
}
