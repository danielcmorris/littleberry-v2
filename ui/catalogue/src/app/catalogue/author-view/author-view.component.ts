import { Component, input, inject, computed, signal, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangService } from '../../core/lang.service';
import { I18N } from '../../core/i18n.tokens';
import { BookCardComponent } from '../book-card/book-card.component';
import { BooksService } from '../../core/books.service';
import { Book } from '../../core/book.model';

@Component({
  selector: 'app-author-view',
  standalone: true,
  imports: [BookCardComponent, RouterLink],
  template: `
    <section class="sect">
      <button class="crumb" routerLink="/">&#x2190; {{ i18n()['nav_home'] }}</button>
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
            <app-book-card [book]="b" [queryParams]="{ from: 'author', ctx: author() }" />
          }
        </div>
      }
    </section>
  `,
})
export class AuthorViewComponent {
  author = input<string>('');

  private langSvc = inject(LangService);
  private svc = inject(BooksService);

  i18n = computed(() => I18N[this.langSvc.lang()] ?? I18N['en']);
  books = signal<Book[]>([]);
  total = signal(0);
  loading = signal(true);

  constructor() {
    effect((onCleanup) => {
      const a = this.author();
      if (!a) return;
      this.books.set([]);
      this.loading.set(true);
      const sub = this.svc.getBooks({ author: a, pageSize: 100 }).subscribe(p => {
        this.books.set(p.items);
        this.total.set(p.total);
        this.loading.set(false);
      });
      onCleanup(() => sub.unsubscribe());
    });
  }
}
