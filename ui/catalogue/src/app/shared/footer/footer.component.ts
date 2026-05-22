import { Component, inject, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LangService } from '../../core/lang.service';
import { BooksService } from '../../core/books.service';
import { I18N } from '../../core/i18n.tokens';

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
  private langSvc = inject(LangService);
  private svc = inject(BooksService);
  i18n = computed(() => I18N[this.langSvc.lang()] ?? I18N['en']);
  totalBooks = computed(() => this.svc.totalBooks());
}
