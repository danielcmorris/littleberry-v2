import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { LangService } from '../../core/lang.service';
import { BooksService } from '../../core/books.service';
import { I18N } from '../../core/i18n.tokens';

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
          <button class="subject-tile" [style.background]="s.tile" (click)="navigate(s.key)">
            <div class="subject-tile-pattern" aria-hidden="true">
              <div></div><div></div><div></div><div></div>
            </div>
            <div class="subject-tile-body">
              <div class="subject-tile-prefix">{{ s.prefix }}</div>
              <div class="subject-tile-name">{{ lang() === 'pt' ? s.pt : s.key }}</div>
              <div class="subject-tile-count">{{ s.bookCount }} {{ s.bookCount === 1 ? i18n()['book_count_one'] : i18n()['books_count'] }}</div>
            </div>
          </button>
        }
      </div>
    </section>
  `,
})
export class SubjectTilesComponent {
  private router = inject(Router);
  private langSvc = inject(LangService);
  private svc = inject(BooksService);

  lang = computed(() => this.langSvc.lang());
  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);
  subjects = computed(() => this.svc.subjects());

  navigate(key: string) {
    this.router.navigate(['/subject', key]);
  }
}
