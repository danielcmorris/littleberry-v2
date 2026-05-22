import { Component, input, output, model, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Book } from '../../core/book.model';
import { I18N } from '../../core/i18n.tokens';
import { BookCardComponent } from '../book-card/book-card.component';

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
          />
          <div class="filter-head-count">
            {{ query() ? (results().length + ' ' + i18n()['search_results']) : '&#x2014;' }}
          </div>
        </div>
      </header>
      @if (query() && results().length === 0) {
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
  books = input.required<Book[]>();
  lang = input<string>('en');
  query = model<string>('');
  open = output<Book>();
  navHome = output<void>();

  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);

  results = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];
    return this.books().filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.call_number.toLowerCase().includes(q) ||
      b.subject.toLowerCase().includes(q) ||
      (b.subject_pt ?? '').toLowerCase().includes(q)
    );
  });
}
