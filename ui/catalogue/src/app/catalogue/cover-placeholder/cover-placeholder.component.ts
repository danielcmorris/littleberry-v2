import { Component, input, inject, computed } from '@angular/core';
import { Book } from '../../core/book.model';
import { LangService } from '../../core/lang.service';
import { I18N } from '../../core/i18n.tokens';

@Component({
  selector: 'app-cover-placeholder',
  standalone: true,
  template: `
    <div class="cover cover--placeholder" [style.aspect-ratio]="ratio()">
      <div class="cover-bg"></div>
      <div class="cover-frame"></div>
      <div class="cover-stamp">
        <div class="cover-stamp-inner">
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

  private langSvc = inject(LangService);
  i18n = computed(() => I18N[this.langSvc.lang()] ?? I18N['en']);

  lastTwoWords(name: string): string {
    return name.split(' ').slice(-2).join(' ');
  }
}
