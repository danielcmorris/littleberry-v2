import { Component, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18N } from '../../core/i18n.tokens';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [FormsModule],
  template: `
    <header class="site-header">
      <div class="site-header-inner">
        <button class="brand" (click)="navHome.emit()">
          <img class="brand-mark" src="assets/pfsa-logo.png" alt="PFSA" />
          <div class="brand-text">
            <div class="brand-title">{{ i18n()['site'] }}</div>
            <div class="brand-tag">{{ i18n()['tagline'] }}</div>
          </div>
        </button>
        <nav class="nav">
          @for (item of navItems(); track item.key) {
            <button
              [class]="'nav-item' + (view() === item.key ? ' is-active' : '')"
              (click)="navigate(item.key)">
              {{ item.label }}
            </button>
          }
        </nav>
        <div class="site-tools">
          <div class="search-wrap">
            <span class="search-icon" aria-hidden="true">&#x2315;</span>
            <input
              class="search-input"
              [placeholder]="i18n()['search_placeholder']"
              [value]="query()"
              (focus)="navSearch.emit()"
              (input)="onSearch($event)"
            />
          </div>
          <button class="lang-toggle" (click)="toggleLang()">
            <span class="lang-toggle-active">{{ lang() === 'en' ? 'EN' : 'PT' }}</span>
            <span class="lang-toggle-sep">/</span>
            <span class="lang-toggle-other">{{ lang() === 'en' ? 'PT' : 'EN' }}</span>
          </button>
        </div>
      </div>
      <div class="site-header-rule" aria-hidden="true"></div>
    </header>
  `,
})
export class HeaderComponent {
  view = input<string>('home');
  lang = input<string>('en');
  query = input<string>('');
  navHome = output<void>();
  navAuthors = output<void>();
  navSubjects = output<void>();
  navSearch = output<void>();
  queryChange = output<string>();
  langChange = output<string>();

  i18n = computed(() => I18N[this.lang()] ?? I18N['en']);

  navItems = computed(() => [
    { key: 'home',     label: this.i18n()['nav_home'] },
    { key: 'authors',  label: this.i18n()['nav_authors'] },
    { key: 'subjects', label: this.i18n()['nav_subjects'] },
  ]);

  navigate(key: string) {
    if (key === 'home')     this.navHome.emit();
    if (key === 'authors')  this.navAuthors.emit();
    if (key === 'subjects') this.navSubjects.emit();
  }

  onSearch(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this.queryChange.emit(val);
    this.navSearch.emit();
  }

  toggleLang() {
    this.langChange.emit(this.lang() === 'en' ? 'pt' : 'en');
  }
}
