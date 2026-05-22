import { Component, inject, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LangService } from '../../core/lang.service';
import { I18N } from '../../core/i18n.tokens';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="site-header">
      <div class="site-header-inner">
        <button class="brand" routerLink="/">
          <img class="brand-mark" src="assets/pfsa-logo.png" alt="PFSA" />
          <div class="brand-text">
            <div class="brand-title">{{ i18n()['site'] }}</div>
            <div class="brand-tag">{{ i18n()['tagline'] }}</div>
          </div>
        </button>
        <nav class="nav">
          <button class="nav-item" routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{exact:true}">{{ i18n()['nav_home'] }}</button>
          <button class="nav-item" routerLink="/authors" routerLinkActive="is-active">{{ i18n()['nav_authors'] }}</button>
          <button class="nav-item" routerLink="/subjects" routerLinkActive="is-active">{{ i18n()['nav_subjects'] }}</button>
        </nav>
        <div class="site-tools">
          <div class="search-wrap">
            <span class="search-icon" aria-hidden="true">&#x2315;</span>
            <input
              class="search-input"
              [placeholder]="i18n()['search_placeholder']"
              (focus)="onFocus()"
              (input)="onSearch($event)"
            />
          </div>
          <button class="lang-toggle" (click)="langSvc.toggle()">
            <span class="lang-toggle-active">{{ langSvc.lang() === 'en' ? 'EN' : 'PT' }}</span>
            <span class="lang-toggle-sep">/</span>
            <span class="lang-toggle-other">{{ langSvc.lang() === 'en' ? 'PT' : 'EN' }}</span>
          </button>
        </div>
      </div>
      <div class="site-header-rule" aria-hidden="true"></div>
    </header>
  `,
})
export class HeaderComponent {
  langSvc = inject(LangService);
  private router = inject(Router);

  i18n = computed(() => I18N[this.langSvc.lang()] ?? I18N['en']);

  onFocus() {
    this.router.navigate(['/search']);
  }

  onSearch(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this.router.navigate(['/search'], { queryParams: { q: val } });
  }
}
