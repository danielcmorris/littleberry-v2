import { Component, input, output, inject, computed } from '@angular/core';
import { Book } from '../../core/book.model';
import { I18N } from '../../core/i18n.tokens';
import { BooksService } from '../../core/books.service';

@Component({
  selector: 'app-subject-tiles',
  standalone: true,
  template: `
    <section class="sect">
      <header class="sect-head">
        <div>
          <h2 class="sect-h">{{ i18n()['browse_by'] }}</h2>
          <div class="sect-sub">{{ i18n()['browse_by_sub'] }}</div>
        </div>
      </header>
      <div class="subject-mosaic">
        @for (s of subjects(); track s.key) {
          <button class="subject-tile" [style.background]="s.tile" (click)="navSubject.emit(s.key)">
            <div class="subject-tile-pattern" aria-hidden="true">
              <div></div><div></div><div></div><div></div>
            </div>
            <div class="subject-tile-body">
              <div class="subject-tile-prefix">{{ s.prefix }}</div>
              <div class="subject-tile-name">{{ lang() === 'pt' ? s.pt : s.key }}</div>
              <div class="subject-tile-count">{{ countFor(s.key) }} {{ countFor(s.key) === 1 ? i18n()['book_count_one'] : i18n()['books_count'] }}</div>
            </div>
          </button>
        }
      </div>
    </section>
  `,
})
export class SubjectTilesComponent {
  books = input.required<Book[]>();
  lang = input<string>('en');
  navSubject = output<string>();

  private svc = inject(BooksService);
  subjects = computed(() => this.svc.subjects());
  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);

  countFor(key: string): number {
    return this.books().filter(b => b.subject === key).length;
  }
}
