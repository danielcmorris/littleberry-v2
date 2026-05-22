import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { LangService } from '../../core/lang.service';
import { I18N } from '../../core/i18n.tokens';
import { BookCardComponent } from '../book-card/book-card.component';
import { BooksService } from '../../core/books.service';
import { Book } from '../../core/book.model';

function fmtDate(iso: string, lang: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  const months: Record<string, string[]> = {
    en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    pt: ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],
  };
  return `${d.getDate()} ${(months[lang] ?? months['en'])[d.getMonth()]} ${d.getFullYear()}`;
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
      @if (loading()) {
        <div style="padding:40px;text-align:center;font-family:var(--mono);font-size:12px;opacity:.5">Loading…</div>
      } @else {
        <div class="arrivals-grid">
          @for (b of recent(); track b.id; let i = $index) {
            <div [class]="'arrival arrival-' + i">
              <app-book-card [book]="b" [size]="i === 0 ? 'lg' : 'md'" />
              <div class="arrival-added">{{ fmt(b.added) }}</div>
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class NewArrivalsComponent implements OnInit {
  private langSvc = inject(LangService);
  private svc = inject(BooksService);

  i18n = computed(() => I18N[this.langSvc.lang()] ?? I18N['en']);
  recent = signal<Book[]>([]);
  loading = signal(true);
  monthCount = signal(0);

  ngOnInit() {
    this.svc.getBooks({ pageSize: 9 }).subscribe(page => {
      this.recent.set(page.items);
      this.monthCount.set(page.total);
      this.loading.set(false);
    });
  }

  fmt(iso: string): string {
    return fmtDate(iso, this.langSvc.lang());
  }
}
