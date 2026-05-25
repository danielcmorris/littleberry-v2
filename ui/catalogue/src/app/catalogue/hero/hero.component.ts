import { Component, input, inject, computed } from '@angular/core';
import { workPath } from '../../core/slugify';
import { RouterLink } from '@angular/router';
import { Book } from '../../core/book.model';
import { LangService } from '../../core/lang.service';
import { I18N } from '../../core/i18n.tokens';
import { CoverComponent } from '../cover/cover.component';
import { BooksService } from '../../core/books.service';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CoverComponent, RouterLink],
  template: `
    <section class="hero">
      <div class="hero-azulejo" aria-hidden="true"></div>
      <div class="hero-inner">
        <button class="hero-cover" [routerLink]="bookRoute()">
          <app-cover [book]="book()" />
        </button>
        <div class="hero-body">
          <div class="hero-kicker">
            <span class="hero-kicker-dot"></span>
            {{ i18n()['hero_kicker'] }}
          </div>
          <h1 class="hero-title">{{ book().title }}</h1>
          <div class="hero-author">{{ i18n()['by'] }} <em>{{ book().author }}</em></div>
          <div class="hero-notes">{{ book().notes }}</div>
          <div class="hero-meta">
            <div class="hero-meta-row">
              <span class="hero-meta-k">{{ i18n()['detail_published'] }}</span>
              <span class="hero-meta-v">{{ book().year }} &middot; {{ book().publisher_city }}</span>
            </div>
            <div class="hero-meta-row">
              <span class="hero-meta-k">{{ i18n()['detail_subject'] }}</span>
              <span class="hero-meta-v">{{ lang() === 'pt' ? subjectPt() : book().subject }}</span>
            </div>
            <div class="hero-meta-row">
              <span class="hero-meta-k">{{ i18n()['detail_call'] }}</span>
              <span class="hero-meta-v hero-call">{{ book().call_number }}</span>
            </div>
          </div>
          <button class="hero-cta" [routerLink]="bookRoute()">
            {{ i18n()['view_book'] }} <span aria-hidden="true">&#x2192;</span>
          </button>
        </div>
      </div>
    </section>
  `,
})
export class HeroComponent {
  book = input.required<Book>();

  private langSvc = inject(LangService);
  private svc = inject(BooksService);

  lang = computed(() => this.langSvc.lang());
  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);

  bookRoute = computed(() => {
    const b = this.book();
    return b.seq_id ? ['/','book', workPath(b.seq_id, b.title)] : ['/', b.call_number];
  });

  subjectPt = computed(() => {
    const subj = this.svc.subjects().find(s => s.key === this.book().subject);
    return subj?.pt ?? this.book().subject;
  });
}
