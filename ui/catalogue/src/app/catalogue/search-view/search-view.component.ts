import { Component, input, inject, computed, signal, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subject as RxSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { LangService } from '../../core/lang.service';
import { I18N } from '../../core/i18n.tokens';
import { BookCardComponent } from '../book-card/book-card.component';
import { BooksService } from '../../core/books.service';
import { Book } from '../../core/book.model';

@Component({
  selector: 'app-search-view',
  standalone: true,
  imports: [BookCardComponent, RouterLink],
  template: `
    <section class="sect">
      <button class="crumb" routerLink="/">&#x2190; {{ i18n()['nav_home'] }}</button>
      <header class="filter-head filter-head--search">
        <div class="filter-head-inner">
          <div class="filter-head-kicker">{{ i18n()['nav_search'] }}</div>
          <input
            class="search-bigbox"
            [value]="q() ?? ''"
            placeholder="Title, author, or call number…"
            autofocus
            (input)="onInput($event)"
          />
          <div class="filter-head-count">
            {{ (q() ?? '') ? (total() + ' ' + i18n()['search_results']) : '&#x2014;' }}
          </div>
        </div>
      </header>
      @if ((q() ?? '') && !loading() && results().length === 0) {
        <div class="empty">{{ i18n()['search_no_results'] }}</div>
      }
      <div class="catalog-grid">
        @for (b of results(); track b.id) {
          <app-book-card [book]="b" [queryParams]="{ from: 'search', ctx: q() ?? '' }" />
        }
      </div>
    </section>
  `,
})
export class SearchViewComponent {
  q = input<string>('');

  private router = inject(Router);
  private langSvc = inject(LangService);
  private svc = inject(BooksService);

  i18n = computed(() => I18N[this.langSvc.lang()] ?? I18N['en']);
  results = signal<Book[]>([]);
  total = signal(0);
  loading = signal(false);

  private search$ = new RxSubject<string>();

  constructor() {
    effect(() => { this.search$.next(this.q() ?? ''); });

    this.search$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => {
        if (!(q ?? '').trim()) {
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

  onInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this.router.navigate(['/search'], { queryParams: { q: val }, replaceUrl: true });
  }
}
