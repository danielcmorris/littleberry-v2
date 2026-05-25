import { Routes } from '@angular/router';
import { HomePageComponent } from './catalogue/home-page/home-page.component';
import { AuthorIndexComponent } from './catalogue/author-index/author-index.component';
import { SubjectTilesComponent } from './catalogue/subject-tiles/subject-tiles.component';
import { SearchViewComponent } from './catalogue/search-view/search-view.component';
import { AuthorViewComponent } from './catalogue/author-view/author-view.component';
import { SubjectViewComponent } from './catalogue/subject-view/subject-view.component';
import { BookDetailComponent } from './catalogue/book-detail/book-detail.component';
import { BookEditComponent } from './catalogue/book-edit/book-edit.component';
import { CallbackComponent } from './catalogue/callback/callback.component';
import { AdminDashboardComponent } from './admin/admin-dashboard.component';
import { AdminCatalogComponent } from './admin/admin-catalog.component';
import { AdminSubjectsComponent } from './admin/admin-subjects.component';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'callback', component: CallbackComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard] },
  { path: 'admin/catalog', component: AdminCatalogComponent, canActivate: [authGuard] },
  { path: 'admin/subjects', component: AdminSubjectsComponent, canActivate: [authGuard] },
  { path: 'admin/new', component: BookEditComponent, canActivate: [authGuard] },
  { path: 'authors', component: AuthorIndexComponent },
  { path: 'authors/:letter', component: AuthorIndexComponent },
  { path: 'subjects', component: SubjectTilesComponent },
  { path: 'search', component: SearchViewComponent },
  { path: 'author/:author', component: AuthorViewComponent },
  { path: 'subject/:subject', component: SubjectViewComponent },
  { path: 'book/:workSlug/edit', component: BookEditComponent, canActivate: [authGuard] },
  { path: 'book/:workSlug', component: BookDetailComponent },
  { path: ':prefix/:bookNumber/edit', component: BookEditComponent, canActivate: [authGuard] },
  { path: ':prefix/:bookNumber', component: BookDetailComponent },
];
