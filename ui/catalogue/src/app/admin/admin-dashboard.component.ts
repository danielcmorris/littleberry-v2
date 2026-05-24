import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';

interface AdminStats {
  subjects: number;
  authors: number;
  files: number;
  catalog: number;
  requests: number;
  shipments: number;
}

const TILES = [
  {
    key: 'catalog' as keyof AdminStats,
    label: 'Catalogue',
    description: 'Browse, search and edit all holdings',
    path: '/admin/catalog',
    accent: '#1a4480',
    letter: 'C',
  },
  {
    key: 'subjects' as keyof AdminStats,
    label: 'Subjects',
    description: 'Subject categories and prefixes',
    path: '/subjects',
    accent: '#234876',
    letter: 'S',
  },
  {
    key: 'authors' as keyof AdminStats,
    label: 'Authors',
    description: 'Author records across all works',
    path: '/authors',
    accent: '#2a5187',
    letter: 'A',
  },
  {
    key: 'files' as keyof AdminStats,
    label: 'Files',
    description: 'Digital copies and uploaded documents',
    path: '/admin/files',
    accent: '#3a5c8c',
    letter: 'F',
  },
  {
    key: 'requests' as keyof AdminStats,
    label: 'Requests',
    description: 'Patron book requests',
    path: '/admin/requests',
    accent: '#1e3565',
    letter: 'R',
    comingSoon: true,
  },
  {
    key: 'shipments' as keyof AdminStats,
    label: 'Shipments',
    description: 'Acquisition shipments and orders',
    path: '/admin/shipments',
    accent: '#162f58',
    letter: 'SH',
    comingSoon: true,
  },
];

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  template: `
    <div class="admin-wrap">
      <div class="admin-header">
        <div class="admin-header-kicker">Administration</div>
        <h1 class="admin-header-title">Dashboard</h1>
      </div>

      <div class="admin-grid">
        @for (tile of tiles; track tile.key) {
          @if (tile.comingSoon) {
            <div class="admin-tile admin-tile--soon" [style.--tile-accent]="tile.accent">
              <div class="admin-tile-letter">{{ tile.letter }}</div>
              <div class="admin-tile-body">
                <div class="admin-tile-label">{{ tile.label }}</div>
                <div class="admin-tile-desc">{{ tile.description }}</div>
              </div>
              <div class="admin-tile-count admin-tile-count--soon">Soon</div>
            </div>
          } @else {
            <a class="admin-tile" [routerLink]="tile.path" [style.--tile-accent]="tile.accent">
              <div class="admin-tile-letter">{{ tile.letter }}</div>
              <div class="admin-tile-body">
                <div class="admin-tile-label">{{ tile.label }}</div>
                <div class="admin-tile-desc">{{ tile.description }}</div>
              </div>
              <div class="admin-tile-count">
                @if (stats()) {
                  {{ stats()![tile.key] | number }}
                } @else {
                  <span class="admin-tile-loading">…</span>
                }
              </div>
              <div class="admin-tile-arrow">→</div>
            </a>
          }
        }
      </div>
    </div>
  `,
})
export class AdminDashboardComponent implements OnInit {
  private http = inject(HttpClient);

  tiles = TILES;
  stats = signal<AdminStats | null>(null);

  ngOnInit() {
    this.http.get<AdminStats>('http://localhost:5200/api/admin/stats').subscribe({
      next: s => this.stats.set(s),
    });
  }
}
