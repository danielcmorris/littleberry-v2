import { Component, input, output, inject, computed } from '@angular/core';
import { Book } from '../../core/book.model';
import { I18N } from '../../core/i18n.tokens';
import { BookCardComponent } from '../book-card/book-card.component';
import { BooksService } from '../../core/books.service';

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
          <h1 class="filter-head-title">{{ lang() === 'pt' ? subjectPt() : subject() }}</h1>
          <div class="filter-head-count">
            {{ list().length }} {{ list().length === 1 ? i18n()['book_count_one'] : i18n()['books_count'] }}
            <span class="filter-head-prefix">&middot; {{ i18n()['detail_call'] }} {{ subjectPrefix() }}</span>
          </div>
        </div>
      </header>
      <div class="catalog-grid">
        @for (b of list(); track b.id) {
          <app-book-card [book]="b" [lang]="lang()" (open)="open.emit($event)" />
        }
      </div>
    </section>
  `,
})
export class SubjectViewComponent {
  subject = input.required<string>();
  books = input.required<Book[]>();
  lang = input<string>('en');
  open = output<Book>();
  navHome = output<void>();

  private svc = inject(BooksService);
  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);

  list = computed(() => this.books().filter(b => b.subject === this.subject()));

  subjectTile = computed(() => this.svc.subjects().find(s => s.key === this.subject())?.tile ?? '#1a4480');
  subjectPt = computed(() => this.svc.subjects().find(s => s.key === this.subject())?.pt ?? this.subject());
  subjectPrefix = computed(() => this.svc.subjects().find(s => s.key === this.subject())?.prefix ?? '');
}
