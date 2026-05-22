import { Component, input, output, computed } from '@angular/core';
import { Book } from '../../core/book.model';
import { I18N } from '../../core/i18n.tokens';
import { BookCardComponent } from '../book-card/book-card.component';

function fmtDate(iso: string, lang: string): string {
  const d = new Date(iso + 'T00:00:00');
  const months: Record<string, string[]> = {
    en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    pt: ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],
  };
  return `${d.getDate()} ${months[lang][d.getMonth()]} ${d.getFullYear()}`;
}

@Component({
  selector: 'app-new-arrivals',
  standalone: true,
  imports: [BookCardComponent],
  template: `
    <section class="sect">
      <header class="sect-head">
        <div>
          <h2 class="sect-h">{{ i18n()['new_arrivals'] }}</h2>
          <div class="sect-sub">{{ i18n()['new_arrivals_sub'] }} &middot; {{ monthCount() }} {{ i18n()['books_count'] }}</div>
        </div>
        <div class="sect-dec">
          <div class="sect-dec-tile"></div>
          <div class="sect-dec-tile"></div>
          <div class="sect-dec-tile"></div>
        </div>
      </header>
      <div class="arrivals-grid">
        @for (b of recent(); track b.id; let i = $index) {
          <div [class]="'arrival arrival-' + i">
            <app-book-card [book]="b" [lang]="lang()" [size]="i === 0 ? 'lg' : 'md'" (open)="open.emit($event)" />
            <div class="arrival-added">{{ fmt(b.added) }}</div>
          </div>
        }
      </div>
    </section>
  `,
})
export class NewArrivalsComponent {
  books = input.required<Book[]>();
  lang = input<string>('en');
  open = output<Book>();

  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);

  recent = computed(() =>
    [...this.books()].sort((a, b) => a.added < b.added ? 1 : -1).slice(0, 9)
  );

  monthCount = computed(() =>
    this.books().filter(b => b.added >= '2026-05-01').length
  );

  fmt(iso: string): string {
    return fmtDate(iso, this.lang());
  }
}
