import { Component, inject, signal, OnInit } from '@angular/core';
import { BooksService } from '../../core/books.service';
import { Book } from '../../core/book.model';
import { HeroComponent } from '../hero/hero.component';
import { NewArrivalsComponent } from '../new-arrivals/new-arrivals.component';
import { SubjectTilesComponent } from '../subject-tiles/subject-tiles.component';
import { AuthorIndexComponent } from '../author-index/author-index.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [HeroComponent, NewArrivalsComponent, SubjectTilesComponent, AuthorIndexComponent],
  template: `
    @if (featured()) {
      <app-hero [book]="featured()!" />
    }
    <app-new-arrivals />
    <app-subject-tiles />
    <app-author-index />
  `,
})
export class HomePageComponent implements OnInit {
  private svc = inject(BooksService);
  featured = signal<Book | null>(null);

  ngOnInit() {
    this.svc.getBooks({ pageSize: 1 }).subscribe(p => {
      if (p.items.length) this.featured.set(p.items[0]);
    });
  }
}
