import { Component, input, inject, signal, computed, effect } from '@angular/core';
import { workPath } from '../../core/slugify';
import { RouterLink } from '@angular/router';
import { BooksService } from '../../core/books.service';
import { LangService } from '../../core/lang.service';
import { AuthService } from '../../core/auth.service';
import { Book } from '../../core/book.model';
import { I18N } from '../../core/i18n.tokens';
import { CoverComponent } from '../cover/cover.component';

@Component({
  selector: 'app-book-detail',
  standalone: true,
  imports: [RouterLink, CoverComponent],
  template: `
    @if (loading()) {
      <div class="book-detail-loading">Loading…</div>
    } @else if (notFound()) {
      <div class="book-detail-loading">Record not found.</div>
    } @else if (book()) {
      <div class="book-detail-page">
        <div class="book-detail-topbar">
          <nav class="breadcrumb">
            <a class="breadcrumb-link" routerLink="/">{{ i18n()['nav_home'] }}</a>
            @if (from() === 'author' && ctx()) {
              <span class="breadcrumb-sep">›</span>
              <a class="breadcrumb-link" [routerLink]="['/author', ctx()]">{{ ctx() }}</a>
            } @else if (from() === 'subject' && ctx()) {
              <span class="breadcrumb-sep">›</span>
              <a class="breadcrumb-link" [routerLink]="['/subject', ctx()]">{{ ctx() }}</a>
            } @else if (from() === 'search' && ctx()) {
              <span class="breadcrumb-sep">›</span>
              <a class="breadcrumb-link" routerLink="/search" [queryParams]="{ q: ctx() }">Search "{{ ctx() }}"</a>
            }
            <span class="breadcrumb-sep">›</span>
            <span class="breadcrumb-current">{{ book()!.call_number }} — {{ book()!.title }}</span>
          </nav>
          @if (authSvc.user()) {
            <a class="detail-edit-link" [routerLink]="['/', prefix(), bookNumber(), 'edit']" [queryParams]="{ from: from() || null, ctx: ctx() || null }">{{ i18n()['edit_title'] }}</a>
          }
        </div>
        <div class="modal-grid">
          <div class="modal-left">
            <div class="modal-cover-wrap">
              <app-cover [book]="book()!" />
            </div>
            <div class="modal-call-strip">
              <span class="modal-call-k">{{ i18n()['detail_call'] }}</span>
              <span class="modal-call-v">{{ book()!.call_number }}</span>
            </div>
            @if (book()!.digital_copies.length > 0) {
              <a class="modal-digital" [href]="book()!.digital_copies[0]" target="_blank" rel="noreferrer">
                <span class="modal-digital-dot"></span>
                {{ i18n()['detail_digital'] }}
                <span class="modal-digital-arrow">&#x2197;</span>
              </a>
            } @else {
              <div class="modal-digital modal-digital--none">
                {{ i18n()['detail_no_digital'] }}
              </div>
            }
          </div>
          <div class="modal-right">
            <div class="modal-kicker">{{ i18n()['detail_record'] }}</div>
            <h2 class="modal-title">{{ book()!.title }}</h2>
            @if (book()!.subtitle) {
              <div class="modal-subtitle">{{ book()!.subtitle }}</div>
            }
            <div class="modal-author">
              {{ i18n()['by'] }}
              <button class="modal-author-link" [routerLink]="['/author', book()!.author]">{{ book()!.author }}</button>
            </div>
            <dl class="modal-dl">
              @if (book()!.year) {
                <div>
                  <dt>{{ i18n()['detail_published'] }}</dt>
                  <dd>{{ book()!.year }}</dd>
                </div>
              }
              @if (book()!.language) {
                <div>
                  <dt>{{ i18n()['detail_language'] }}</dt>
                  <dd>{{ langLabel(book()!.language!) }}</dd>
                </div>
              }
              @if (book()!.publisher) {
                <div>
                  <dt>{{ i18n()['detail_publisher'] }}</dt>
                  <dd>{{ book()!.publisher }}@if (book()!.publisher_city) {, {{ book()!.publisher_city }}}</dd>
                </div>
              }
              @if (book()!.series) {
                <div>
                  <dt>Series</dt>
                  <dd>{{ book()!.series }}</dd>
                </div>
              }
              @if (book()!.pageCount) {
                <div>
                  <dt>Pages</dt>
                  <dd>{{ book()!.pageCount }}</dd>
                </div>
              }
              @if (book()!.isbn13 || book()!.isbn10) {
                <div>
                  <dt>ISBN</dt>
                  <dd>{{ book()!.isbn13 || book()!.isbn10 }}</dd>
                </div>
              }
              <div>
                <dt>{{ i18n()['detail_subject'] }}</dt>
                <dd>
                  <button class="modal-subj-link" [routerLink]="['/subject', book()!.subject]">
                    <span class="modal-subj-swatch" [style.background]="subjectTile()"></span>
                    {{ book()!.subject }}
                  </button>
                </dd>
              </div>
              @if (book()!.notes) {
                <div>
                  <dt>{{ i18n()['detail_notes'] }}</dt>
                  <dd class="modal-notes">{{ book()!.notes }}</dd>
                </div>
              }
            </dl>
            @if (book()!.description) {
              <p class="modal-description">{{ book()!.description }}</p>
            }
            @if (otherBooks().length > 0) {
              <div class="modal-other">
                <div class="modal-other-h">{{ i18n()['detail_other'] }}</div>
                <div class="modal-other-grid">
                  @for (b of otherBooks(); track b.id) {
                    <button class="modal-other-card" [routerLink]="otherBookRoute(b)">
                      <div class="modal-other-cover">
                        <app-cover [book]="b" [small]="true" />
                      </div>
                      <div class="modal-other-meta">
                        <div class="modal-other-title">{{ b.title }}</div>
                        <div class="modal-other-year">{{ b.year }}</div>
                      </div>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class BookDetailComponent {
  prefix = input<string>('');
  bookNumber = input<string>('');
  workSlug = input<string>('');
  from = input<string>('');
  ctx = input<string>('');

  private svc = inject(BooksService);
  private langSvc = inject(LangService);
  readonly authSvc = inject(AuthService);

  book = signal<Book | null>(null);
  otherBooks = signal<Book[]>([]);
  loading = signal(true);
  notFound = signal(false);

  i18n = computed(() => I18N[this.langSvc.lang()] ?? I18N['en']);

  subjectTile = computed(() => {
    const b = this.book();
    if (!b) return '#1a4480';
    return this.svc.subjects().find(s => s.key === b.subject)?.tile ?? '#1a4480';
  });

  constructor() {
    effect((onCleanup) => {
      const slug = this.workSlug();
      const callNumber = this.prefix() + this.bookNumber();
      if (!slug && !callNumber) return;

      this.loading.set(true);
      this.notFound.set(false);
      this.book.set(null);
      this.otherBooks.set([]);

      const seqId = slug ? parseInt(slug.split('-')[0], 10) : NaN;
      const fetch$ = !isNaN(seqId)
        ? this.svc.getWorkBySeqId(seqId)
        : this.svc.getBook(callNumber);

      const sub = fetch$.subscribe({
        next: b => {
          this.book.set(b);
          this.loading.set(false);
          if (b.author) {
            this.svc.getBooks({ author: b.author, pageSize: 5 }).subscribe(p => {
              this.otherBooks.set(p.items.filter(x => x.id !== b.id).slice(0, 4));
            });
          }
        },
        error: () => {
          this.notFound.set(true);
          this.loading.set(false);
        },
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  otherBookRoute(b: Book): string[] {
    return b.seq_id ? ['/','book', workPath(b.seq_id, b.title)] : ['/', b.call_number];
  }

  langLabel(code: string): string {
    const map: Record<string, string> = {
      'por': 'Portuguese', 'pt': 'Portuguese', 'pt-BR': 'Portuguese (Brazil)',
      'eng': 'English', 'en': 'English',
      'spa': 'Spanish', 'es': 'Spanish',
      'fra': 'French', 'fr': 'French',
      'deu': 'German', 'de': 'German',
      'ita': 'Italian', 'it': 'Italian',
      'lat': 'Latin',
    };
    return map[code] ?? code;
  }
}
