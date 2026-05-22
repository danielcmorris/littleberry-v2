import { Component, input, output, inject, computed, signal, OnChanges, SimpleChanges } from '@angular/core';
import { I18N } from '../../core/i18n.tokens';
import { BookCardComponent } from '../book-card/book-card.component';
import { BooksService } from '../../core/books.service';
import { Book } from '../../core/book.model';

@Component({
  selector: 'app-author-view',
  standalone: true,
  imports: [BookCardComponent],
  template: `
    <section class="sect">
      <button class="crumb" (click)="navHome.emit()">&#x2190; {{ i18n()['nav_home'] }}</button>
      <header class="filter-head filter-head--author">
        <div class="filter-head-pattern" aria-hidden="true">
          <div></div><div></div><div></div><div></div>
          <div></div><div></div><div></div><div></div>
        </div>
        <div class="filter-head-inner">
          <div class="filter-head-kicker">{{ i18n()['sect_authors'] }}</div>
          <h1 class="filter-head-title">{{ author() }}</h1>
          <div class="filter-head-count">
            {{ total() }} {{ total() === 1 ? i18n()['book_count_one'] : i18n()['books_count'] }}
          </div>
        </div>
      </header>
      @if (loading()) {
        <div style="padding:40px;text-align:center;font-family:var(--mono);font-size:12px;opacity:.5">Loading…</div>
      } @else {
        <div class="catalog-grid">
          @for (b of books(); track b.id) {
            <app-book-card [book]="b" [lang]="lang()" (open)="open.emit($event)" />
          }
        </div>
      }
    </section>
  `,
})
export class AuthorViewComponent implements OnChanges {
  author = input.required<string>();
  lang = input<string>('en');
  open = output<Book>();
  navHome = output<void>();

  private svc = inject(BooksService);
  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);
  books = signal<Book[]>([]);
  total = signal(0);
  loading = signal(true);

  ngOnChanges(_changes: SimpleChanges) {
    this.books.set([]);
    this.loading.set(true);
    this.svc.getBooks({ author: this.author(), pageSize: 100 }).subscribe(p => {
      this.books.set(p.items);
      this.total.set(p.total);
      this.loading.set(false);
    });
  }
}
