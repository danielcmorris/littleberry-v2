import { Component, input, output, inject, computed, signal, OnChanges, SimpleChanges } from '@angular/core';
import { I18N } from '../../core/i18n.tokens';
import { BookCardComponent } from '../book-card/book-card.component';
import { BooksService } from '../../core/books.service';
import { Book } from '../../core/book.model';

@Component({
  selector: 'app-subject-view',
  standalone: true,
  imports: [BookCardComponent],
  template: `
    <section class="sect">
      <button class="crumb" (click)="navHome.emit()">&#x2190; {{ i18n()['nav_home'] }}</button>
      <header class="filter-head" [style.background]="subjectTile()">
        <div class="filter-head-pattern" aria-hidden="true">
          <div></div><div></div><div></div><div></div>
          <div></div><div></div><div></div><div></div>
        </div>
        <div class="filter-head-inner">
          <div class="filter-head-kicker">{{ i18n()['sect_subjects'] }}</div>
          <h1 class="filter-head-title">{{ subject() }}</h1>
          <div class="filter-head-count">
            {{ total() }} {{ total() === 1 ? i18n()['book_count_one'] : i18n()['books_count'] }}
            <span class="filter-head-prefix">&middot; {{ i18n()['detail_call'] }} {{ subjectPrefix() }}</span>
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
        @if (page() < totalPages()) {
          <div style="text-align:center;margin-top:32px">
            <button class="hero-cta" (click)="loadMore()">Load more</button>
          </div>
        }
      }
    </section>
  `,
})
export class SubjectViewComponent implements OnChanges {
  subject = input.required<string>();
  lang = input<string>('en');
  open = output<Book>();
  navHome = output<void>();

  private svc = inject(BooksService);
  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);
  books = signal<Book[]>([]);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  loading = signal(true);

  subjectTile = computed(() => this.svc.subjects().find(s => s.key === this.subject())?.tile ?? '#1a4480');
  subjectPrefix = computed(() => this.svc.subjects().find(s => s.key === this.subject())?.prefix ?? '');

  ngOnChanges(_changes: SimpleChanges) {
    this.books.set([]);
    this.page.set(1);
    this.loading.set(true);
    this.fetch();
  }

  fetch() {
    this.svc.getBooks({ subject: this.subject(), page: this.page(), pageSize: 48 }).subscribe(p => {
      this.books.update(existing => [...existing, ...p.items]);
      this.total.set(p.total);
      this.totalPages.set(p.totalPages);
      this.loading.set(false);
    });
  }

  loadMore() {
    this.page.update(p => p + 1);
    this.fetch();
  }
}
