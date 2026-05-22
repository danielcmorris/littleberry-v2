import { Component, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LangService } from '../../core/lang.service';
import { BooksService, ApiAuthor } from '../../core/books.service';
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
        <div class="search-wrap">
          <span class="search-icon" aria-hidden="true">&#x2315;</span>
          <input class="search-input" type="search"
            [placeholder]="i18n()['authors_filter']"
            (input)="query.set($any($event.target).value)" />
        </div>
      </header>
      <nav class="author-alpha-nav" id="author-nav">
        @for (entry of ordered(); track entry[0]) {
          <a class="author-alpha-link" href="#"
            (click)="$event.preventDefault(); scrollTo(entry[0])">{{ entry[0] }}</a>
        }
      </nav>
      <div class="author-index">
        @for (entry of ordered(); track entry[0]) {
          <div class="author-letter-block" [id]="'author-' + entry[0]">
            <div class="author-letter-row">
              <div class="author-letter">{{ entry[0] }}</div>
              <a class="author-back-top" href="#"
                (click)="$event.preventDefault(); scrollToTop()">↑ top</a>
            </div>
            <ul class="author-list">
              @for (a of entry[1]; track a.name) {
                <li>
                  <button class="author-row" (click)="navigate(a.name)">
                    <span class="author-row-name">{{ a.name }}</span><span class="author-row-count">({{ a.bookCount }} {{ a.bookCount === 1 ? i18n()['book_count_one'] : i18n()['books_count'] }})</span>
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
  private router = inject(Router);
  private langSvc = inject(LangService);
  private svc = inject(BooksService);

  i18n = computed(() => I18N[this.langSvc.lang()] ?? I18N['en']);
  authors = computed(() => this.svc.authors());
  query = signal('');

  ordered = computed(() => {
    const q = this.query().toLowerCase().trim();
    const source = q
      ? this.authors().filter(a => a.name.toLowerCase().includes(q))
      : this.authors();
    const letters = new Map<string, ApiAuthor[]>();
    for (const a of source) {
      const baseName = a.name
        .replace(/\s*\(.*?\)\s*/g, ' ')
        .split(' ').map(w => w.replace(/^-+/, '')).filter(w => w).join(' ')
        .trim();
      const lastName = baseName.split(' ').pop() ?? baseName;
      const l = lastName[0]?.toUpperCase() ?? '#';
      if (!letters.has(l)) letters.set(l, []);
      letters.get(l)!.push(a);
    }
    return [...letters.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });

  navigate(name: string) {
    this.router.navigate(['/author', name]);
  }

  scrollTo(letter: string) {
    document.getElementById('author-' + letter)?.scrollIntoView({ behavior: 'smooth' });
  }

  scrollToTop() {
    document.getElementById('author-nav')?.scrollIntoView({ behavior: 'smooth' });
  }
}
