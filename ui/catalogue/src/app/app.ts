import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BooksService } from './core/books.service';
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    <div class="biblio">
      <app-header />
      <main class="site-main">
        <router-outlet />
      </main>
      <app-footer />
    </div>
  `,
})
export class App implements OnInit {
  private svc = inject(BooksService);

  ngOnInit() {
    this.svc.loadStats().subscribe();
    this.svc.loadSubjects().subscribe();
    this.svc.loadAuthors(500).subscribe();
  }
}
