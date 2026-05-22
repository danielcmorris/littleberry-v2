import { Component, input, output, computed } from '@angular/core';
import { Book } from '../../core/book.model';
import { I18N } from '../../core/i18n.tokens';
import { CoverComponent } from '../cover/cover.component';

@Component({
  selector: 'app-book-card',
  standalone: true,
  imports: [CoverComponent],
  template: `
    <button [class]="'bookcard bookcard--' + size()" (click)="open.emit(book())">
      <div class="bookcard-cover">
        <app-cover [book]="book()" [lang]="lang()" />
        @if (isNew()) {
          <span class="bookcard-newbadge">{{ i18n()['new_label'] }}</span>
        }
      </div>
      <div class="bookcard-meta">
        <div class="bookcard-call">{{ book().call_number }}</div>
        <div class="bookcard-title">{{ book().title }}</div>
        <div class="bookcard-author">{{ book().author }}</div>
        <div class="bookcard-year">{{ book().year }}</div>
      </div>
    </button>
  `,
})
export class BookCardComponent {
  book = input.required<Book>();
  lang = input<string>('en');
  size = input<string>('md');
  open = output<Book>();

  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);

  isNew(): boolean {
    return this.book().added >= '2026-05-15';
  }
}
