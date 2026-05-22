import { Component, input, output, computed } from '@angular/core';
import { Book } from '../../core/book.model';
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
                    <span class="author-row-count">{{ a.count }} {{ a.count === 1 ? i18n()['book_count_one'] : i18n()['books_count'] }}</span>
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
  books = input.required<Book[]>();
  lang = input<string>('en');
  navAuthor = output<string>();

  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);

  authors = computed(() => {
    const map = new Map<string, number>();
    for (const b of this.books()) {
      if (b.author === 'Anonymous') continue;
      map.set(b.author, (map.get(b.author) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count, key: name.split(' ').pop()! }))
      .sort((a, b) => a.key.localeCompare(b.key));
  });

  ordered = computed(() => {
    const letters = new Map<string, { name: string; count: number }[]>();
    for (const a of this.authors()) {
      const l = a.key[0].toUpperCase();
      if (!letters.has(l)) letters.set(l, []);
      letters.get(l)!.push(a);
    }
    return [...letters.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });
}
