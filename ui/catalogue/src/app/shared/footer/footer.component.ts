import { Component, input, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { I18N } from '../../core/i18n.tokens';
import { BooksService } from '../../core/books.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <footer class="site-foot">
      <div class="site-foot-rule" aria-hidden="true"></div>
      <div class="site-foot-inner">
        <div class="site-foot-l">
          <span class="brand-glyph" aria-hidden="true"></span>
          <span>LittleBerry &middot; {{ totalBooks() | number }} {{ i18n()['on_shelves'] }}</span>
        </div>
        <div class="site-foot-r">{{ i18n()['footer'] }}</div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  lang = input<string>('en');
  private svc = inject(BooksService);
  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);
  totalBooks = computed(() => this.svc.totalBooks());
}
