import { Component, input, inject, computed, signal } from '@angular/core';
import { Book } from '../../core/book.model';
import { CoverPlaceholderComponent } from '../cover-placeholder/cover-placeholder.component';
import { BooksService } from '../../core/books.service';

@Component({
  selector: 'app-cover',
  standalone: true,
  imports: [CoverPlaceholderComponent],
  template: `
    @if (book().has_cover && book().cover_url) {
      <div class="cover" [style.aspect-ratio]="ratio()" style="overflow:hidden">
        <img
          [src]="book().cover_url!"
          [alt]="book().title"
          style="width:100%;height:100%;object-fit:cover;display:block"
          (error)="imgError.set(true)"
        />
        @if (imgError()) {
          <app-cover-placeholder [book]="book()" [ratio]="ratio()" [small]="small()" />
        }
      </div>
    } @else {
      <app-cover-placeholder [book]="book()" [ratio]="ratio()" [small]="small()" />
    }
  `,
})
export class CoverComponent {
  book = input.required<Book>();
  ratio = input<string>('2/3');
  small = input<boolean>(false);
  lang = input<string>('en');

  imgError = signal(false);
  private svc = inject(BooksService);

  tileColor = computed(() => {
    const subj = this.svc.subjects().find(s => s.key === this.book().subject);
    return subj?.tile ?? '#1a4480';
  });
}
