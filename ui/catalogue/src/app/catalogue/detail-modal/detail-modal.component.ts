import { Component, input, output, inject, OnInit, OnDestroy, computed } from '@angular/core';
import { Book } from '../../core/book.model';
import { I18N } from '../../core/i18n.tokens';
import { CoverComponent } from '../cover/cover.component';
import { BooksService } from '../../core/books.service';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-detail-modal',
  standalone: true,
  imports: [CoverComponent],
  template: `
    <div class="modal-scrim" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <button class="modal-x" (click)="close.emit()" aria-label="Close">&#x2715;</button>
        <div class="modal-grid">
          <div class="modal-left">
            <div class="modal-cover-wrap">
              <app-cover [book]="book()" [lang]="lang()" />
            </div>
            <div class="modal-call-strip">
              <span class="modal-call-k">{{ i18n()['detail_call'] }}</span>
              <span class="modal-call-v">{{ book().call_number }}</span>
            </div>
            @if (book().digital_copies.length > 0) {
              <a class="modal-digital" [href]="book().digital_copies[0]" target="_blank" rel="noreferrer">
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
            <h2 class="modal-title">{{ book().title }}</h2>
            <div class="modal-author">
              {{ i18n()['by'] }}
              <button class="modal-author-link" (click)="navAuthor()">{{ book().author }}</button>
            </div>
            <dl class="modal-dl">
              <div>
                <dt>{{ i18n()['detail_published'] }}</dt>
                <dd>{{ book().year }}</dd>
              </div>
              <div>
                <dt>{{ i18n()['detail_publisher'] }}</dt>
                <dd>{{ book().publisher }}, {{ book().publisher_city }}</dd>
              </div>
              <div>
                <dt>{{ i18n()['detail_subject'] }}</dt>
                <dd>
                  <button class="modal-subj-link" (click)="navSubject()">
                    <span class="modal-subj-swatch" [style.background]="subjectTile()"></span>
                    {{ lang() === 'pt' ? subjectPt() : book().subject }}
                  </button>
                </dd>
              </div>
              <div>
                <dt>{{ i18n()['detail_notes'] }}</dt>
                <dd class="modal-notes">{{ book().notes }}</dd>
              </div>
            </dl>
            @if (otherBooks().length > 0) {
              <div class="modal-other">
                <div class="modal-other-h">{{ i18n()['detail_other'] }}</div>
                <div class="modal-other-grid">
                  @for (b of otherBooks(); track b.id) {
                    <button class="modal-other-card" (click)="openOther(b)">
                      <div class="modal-other-cover">
                        <app-cover [book]="b" [small]="true" [lang]="lang()" />
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
    </div>
  `,
})
export class DetailModalComponent implements OnInit, OnDestroy {
  book = input.required<Book>();
  lang = input<string>('en');
  close = output<void>();
  navigateAuthor = output<string>();
  navigateSubject = output<string>();
  openBook = output<Book>();

  private svc = inject(BooksService);
  private doc = inject(DOCUMENT);

  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);

  otherBooks = computed(() =>
    this.svc.books().filter(b => b.author === this.book().author && b.id !== this.book().id).slice(0, 4)
  );

  subjectTile = computed(() => {
    const subj = this.svc.subjects().find(s => s.key === this.book().subject);
    return subj?.tile ?? '#1a4480';
  });

  subjectPt = computed(() => {
    const subj = this.svc.subjects().find(s => s.key === this.book().subject);
    return subj?.pt ?? this.book().subject;
  });

  ngOnInit() {
    this.doc.body.style.overflow = 'hidden';
    this.doc.addEventListener('keydown', this.onKey);
  }

  ngOnDestroy() {
    this.doc.body.style.overflow = '';
    this.doc.removeEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close.emit();
  };

  navAuthor() {
    this.close.emit();
    this.navigateAuthor.emit(this.book().author);
  }

  navSubject() {
    this.close.emit();
    this.navigateSubject.emit(this.book().subject);
  }

  openOther(b: Book) {
    this.close.emit();
    setTimeout(() => this.openBook.emit(b), 50);
  }
}
