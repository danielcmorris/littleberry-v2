import { Routes } from '@angular/router';
import { HomePageComponent } from './catalogue/home-page/home-page.component';
import { AuthorIndexComponent } from './catalogue/author-index/author-index.component';
import { SubjectTilesComponent } from './catalogue/subject-tiles/subject-tiles.component';
import { SearchViewComponent } from './catalogue/search-view/search-view.component';
import { AuthorViewComponent } from './catalogue/author-view/author-view.component';
import { SubjectViewComponent } from './catalogue/subject-view/subject-view.component';
import { BookDetailComponent } from './catalogue/book-detail/book-detail.component';
import { CallbackComponent } from './catalogue/callback/callback.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'callback', component: CallbackComponent },
  { path: 'authors', component: AuthorIndexComponent },
  { path: 'subjects', component: SubjectTilesComponent },
  { path: 'search', component: SearchViewComponent },
  { path: 'author/:author', component: AuthorViewComponent },
  { path: 'subject/:subject', component: SubjectViewComponent },
  { path: ':prefix/:bookNumber', component: BookDetailComponent },
];
