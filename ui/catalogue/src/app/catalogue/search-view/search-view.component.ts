import { Component, input, output, model, computed, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject as RxSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { I18N } from '../../core/i18n.tokens';
import { BookCardComponent } from '../book-card/book-card.component';
import { BooksService } from '../../core/books.service';
import { Book } from '../../core/book.model';

@Component({
  selector: 'app-search-view',
  standalone: true,
  imports: [FormsModule, BookCardComponent],
  template: `
    <section class="sect">
      <button class="crumb" (click)="navHome.emit()">&#x2190; {{ i18n()['nav_home'] }}</button>
      <header class="filter-head filter-head--search">
        <div class="filter-head-inner">
          <div class="filter-head-kicker">{{ i18n()['nav_search'] }}</div>
          <input
            class="search-bigbox"
            [(ngModel)]="query"
            [placeholder]="i18n()['search_placeholder']"
            autofocus
            (ngModelChange)="onQueryChange($event)"
          />
          <div class="filter-head-count">
            {{ query() ? (total() + ' ' + i18n()['search_results']) : '&#x2014;' }}
          </div>
        </div>
      </header>
      @if (query() && !loading() && results().length === 0) {
        <div class="empty">{{ i18n()['search_no_results'] }}</div>
      }
      <div class="catalog-grid">
        @for (b of results(); track b.id) {
          <app-book-card [book]="b" [lang]="lang()" (open)="open.emit($event)" />
        }
      </div>
    </section>
  `,
})
export class SearchViewComponent {
  lang = input<string>('en');
  query = model<string>('');
  open = output<Book>();
  navHome = output<void>();

  private svc = inject(BooksService);
  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);
  results = signal<Book[]>([]);
  total = signal(0);
  loading = signal(false);

  private search$ = new RxSubject<string>();

  constructor() {
    effect(() => { this.search$.next(this.query()); });

    this.search$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => {
        if (!q.trim()) {
          this.results.set([]);
          this.total.set(0);
          this.loading.set(false);
          return [];
        }
        this.loading.set(true);
        return this.svc.getBooks({ search: q, pageSize: 48 });
      })
    ).subscribe(page => {
      if (page) {
        this.results.set(page.items);
        this.total.set(page.total);
      }
      this.loading.set(false);
    });
  }

  onQueryChange(q: string) {
    this.search$.next(q);
  }
}
