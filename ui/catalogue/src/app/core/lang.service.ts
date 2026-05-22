import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LangService {
  lang = signal<string>(
    typeof localStorage !== 'undefined' ? (localStorage.getItem('lb_lang') ?? 'en') : 'en'
  );

  constructor() {
    effect(() => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('lb_lang', this.lang());
      }
    });
  }

  toggle() {
    this.lang.set(this.lang() === 'en' ? 'pt' : 'en');
  }
}
