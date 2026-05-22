import { Component, input, computed } from '@angular/core';
import { Book } from '../../core/book.model';
import { I18N } from '../../core/i18n.tokens';

@Component({
  selector: 'app-cover-placeholder',
  standalone: true,
  template: `
    <div class="cover cover--placeholder" [style.aspect-ratio]="ratio()">
      <div class="cover-bg"></div>
      <div class="cover-frame"></div>
      <div class="cover-stamp">
        <div class="cover-stamp-inner" [style.transform]="stampTransform()">
          <div class="cover-stamp-top">{{ i18n()['placeholder_cover_top'] }}</div>
          <div class="cover-stamp-call">{{ book().call_number }}</div>
          <div class="cover-stamp-bar"></div>
          <div class="cover-stamp-mid">{{ i18n()['placeholder_cover_mid'] }}</div>
        </div>
      </div>
      @if (!small()) {
        <div class="cover-foot">
          <span class="cover-foot-title">{{ book().title }}</span>
          <span class="cover-foot-author">{{ lastTwoWords(book().author) }}</span>
        </div>
      }
    </div>
  `,
})
export class CoverPlaceholderComponent {
  book = input.required<Book>();
  ratio = input<string>('2/3');
  small = input<boolean>(false);
  lang = input<string>('en');

  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);

  stampTransform = computed(() => {
    const raw = this.book().book_id ?? this.book().call_number.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const seed = (typeof raw === 'number' ? raw : 0) * 9301 + 49297;
    const rot = ((seed % 100) - 50) / 50 * 1.6;
    const xOff = ((seed >> 3) % 8) - 4;
    return `translateX(${xOff}px) rotate(${rot}deg)`;
  });

  lastTwoWords(name: string): string {
    return name.split(' ').slice(-2).join(' ');
  }
}
