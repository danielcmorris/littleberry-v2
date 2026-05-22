import { Component, input, output, computed } from '@angular/core';
import { ApiAuthor } from '../../core/books.service';
import { I18N } from '../../core/i18n.tokens';

@Component({
  selector: 'app-author-index',
  standalone: true,
  template: `
    <section class="sect">
      <header class="sect-head">
        <div>
          <h2 class="sect-h">{{ i18n()['authors_h'] }}</h2>
          <div class="sect-sub">{{ i18n()['authors_sub'] }} &middot; {{ authors().length }}</div>
        </div>
      </header>
      <div class="author-index">
        @for (entry of ordered(); track entry[0]) {
          <div class="author-letter-block">
            <div class="author-letter">{{ entry[0] }}</div>
            <ul class="author-list">
              @for (a of entry[1]; track a.name) {
                <li>
                  <button class="author-row" (click)="navAuthor.emit(a.name)">
                    <span class="author-row-name">{{ a.name }}</span>
                    <span class="author-row-count">{{ a.bookCount }} {{ a.bookCount === 1 ? i18n()['book_count_one'] : i18n()['books_count'] }}</span>
                  </button>
                </li>
              }
            </ul>
          </div>
        }
      </div>
    </section>
  `,
})
export class AuthorIndexComponent {
  authors = input.required<ApiAuthor[]>();
  lang = input<string>('en');
  navAuthor = output<string>();

  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);

  ordered = computed(() => {
    const letters = new Map<string, ApiAuthor[]>();
    for (const a of this.authors()) {
      const lastName = a.name.split(' ').pop() ?? a.name;
      const l = lastName[0]?.toUpperCase() ?? '#';
      if (!letters.has(l)) letters.set(l, []);
      letters.get(l)!.push(a);
    }
    return [...letters.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });
}
