import { Component, signal, inject, OnInit } from '@angular/core';
import { BooksService } from './core/books.service';
import { ApiAuthor } from './core/books.service';
import { Book } from './core/book.model';
import { Subject } from './core/subject.model';
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';
import { HeroComponent } from './catalogue/hero/hero.component';
import { NewArrivalsComponent } from './catalogue/new-arrivals/new-arrivals.component';
import { SubjectTilesComponent } from './catalogue/subject-tiles/subject-tiles.component';
import { AuthorIndexComponent } from './catalogue/author-index/author-index.component';
import { SubjectViewComponent } from './catalogue/subject-view/subject-view.component';
import { AuthorViewComponent } from './catalogue/author-view/author-view.component';
import { SearchViewComponent } from './catalogue/search-view/search-view.component';
import { DetailModalComponent } from './catalogue/detail-modal/detail-modal.component';

type View = 'home' | 'authors' | 'subjects' | 'author' | 'subject' | 'search';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    HeaderComponent, FooterComponent, HeroComponent, NewArrivalsComponent,
    SubjectTilesComponent, AuthorIndexComponent, SubjectViewComponent,
    AuthorViewComponent, SearchViewComponent, DetailModalComponent,
  ],
  template: `
    <div class="biblio">
      <app-header
        [view]="view()"
        [lang]="lang()"
        [query]="query()"
        (navHome)="goHome()"
        (navAuthors)="view.set('authors'); payload.set(null)"
        (navSubjects)="view.set('subjects'); payload.set(null)"
        (navSearch)="view.set('search')"
        (queryChange)="query.set($event)"
        (langChange)="setLang($event)"
      />

      <main class="site-main">
        @if (view() === 'home') {
          @if (featured()) {
            <app-hero [book]="featured()!" [lang]="lang()" (open)="openModal($event)" />
          }
          <app-new-arrivals [lang]="lang()" (open)="openModal($event)" />
          <app-subject-tiles [subjects]="subjects()" [lang]="lang()" (navSubject)="goSubject($event)" />
          <app-author-index [authors]="authors()" [lang]="lang()" (navAuthor)="goAuthor($event)" />
        }
        @if (view() === 'subjects') {
          <app-subject-tiles [subjects]="subjects()" [lang]="lang()" (navSubject)="goSubject($event)" />
        }
        @if (view() === 'authors') {
          <app-author-index [authors]="authors()" [lang]="lang()" (navAuthor)="goAuthor($event)" />
        }
        @if (view() === 'subject' && payload()) {
          <app-subject-view
            [subject]="payload()!"
            [lang]="lang()"
            (open)="openModal($event)"
            (navHome)="goHome()"
          />
        }
        @if (view() === 'author' && payload()) {
          <app-author-view
            [author]="payload()!"
            [lang]="lang()"
            (open)="openModal($event)"
            (navHome)="goHome()"
          />
        }
        @if (view() === 'search') {
          <app-search-view
            [lang]="lang()"
            [(query)]="query"
            (open)="openModal($event)"
            (navHome)="goHome()"
          />
        }
      </main>

      <app-footer [lang]="lang()" />

      @if (openBook()) {
        <app-detail-modal
          [book]="openBook()!"
          [lang]="lang()"
          (close)="openBook.set(null)"
          (navigateAuthor)="goAuthor($event)"
          (navigateSubject)="goSubject($event)"
          (openBook)="openModal($event)"
        />
      }
    </div>
  `,
})
export class App implements OnInit {
  private svc = inject(BooksService);

  view = signal<View>('home');
  payload = signal<string | null>(null);
  openBook = signal<Book | null>(null);
  query = signal<string>('');
  lang = signal<string>(
    typeof localStorage !== 'undefined' ? (localStorage.getItem('lb_lang') ?? 'en') : 'en'
  );

  subjects = signal<Subject[]>([]);
  authors = signal<ApiAuthor[]>([]);
  featured = signal<Book | null>(null);

  ngOnInit() {
    this.svc.loadStats().subscribe();
    this.svc.loadSubjects().subscribe(s => this.subjects.set(s));
    this.svc.loadAuthors(500).subscribe(a => this.authors.set(a));
    this.svc.getBooks({ pageSize: 1 }).subscribe(p => {
      if (p.items.length) this.featured.set(p.items[0]);
    });
  }

  setLang(l: string) {
    this.lang.set(l);
    if (typeof localStorage !== 'undefined') localStorage.setItem('lb_lang', l);
  }

  goHome() {
    this.view.set('home');
    this.payload.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goSubject(key: string) {
    this.view.set('subject');
    this.payload.set(key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goAuthor(name: string) {
    this.view.set('author');
    this.payload.set(name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openModal(book: Book) { this.openBook.set(book); }
}
