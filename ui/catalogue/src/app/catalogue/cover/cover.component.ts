import { Component, input, inject } from '@angular/core';
import { Book } from '../../core/book.model';
import { CoverPlaceholderComponent } from '../cover-placeholder/cover-placeholder.component';
import { BooksService } from '../../core/books.service';

@Component({
  selector: 'app-cover',
  standalone: true,
  imports: [CoverPlaceholderComponent],
  template: `
    @if (book().has_cover) {
      <div class="cover cover--real" [style.aspect-ratio]="ratio()" [style.background]="tileColor()">
        <div class="cover-real-rule"></div>
        <div class="cover-real-title">{{ book().title }}</div>
        <div class="cover-real-author">{{ book().author.toUpperCase() }}</div>
        <div class="cover-real-mark">{{ book().call_number }}</div>
      </div>
    } @else {
      <app-cover-placeholder [book]="book()" [ratio]="ratio()" [small]="small()" [lang]="lang()" />
    }
  `,
})
export class CoverComponent {
  book = input.required<Book>();
  ratio = input<string>('2/3');
  small = input<boolean>(false);
  lang = input<string>('en');

  private svc = inject(BooksService);

  tileColor(): string {
    const subj = this.svc.subjects().find(s => s.key === this.book().subject);
    return subj?.tile ?? '#1a4480';
  }
}
