import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

interface SubjectRow {
  id: string;
  term: string;
  prefix: string;
  lastBookNumber: number | null;
  bookCount: number;
}

const API = 'http://localhost:5200/api';

@Component({
  selector: 'app-admin-subjects',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe],
  template: `
    <div class="asubj-page">

      <div class="edit-strip">
        <nav class="edit-strip-crumb">
          <a class="edit-strip-crumb-link" routerLink="/admin">Admin</a>
          <span class="edit-strip-crumb-sep">›</span>
          <span class="edit-strip-crumb-current">Subjects</span>
        </nav>
        <div class="edit-actions">
          <button class="edit-btn edit-btn--new" (click)="openAdd()">+ Add Subject</button>
        </div>
      </div>

      <div class="asubj-body">
        @if (loading()) {
          <div class="asubj-loading">Loading…</div>
        } @else {
          <table class="asubj-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Prefix</th>
                <th class="asubj-num">Holdings</th>
                <th class="asubj-num">Next #</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (s of subjects(); track s.id) {
                <tr>
                  <td>{{ s.term }}</td>
                  <td class="asubj-prefix">{{ s.prefix }}</td>
                  <td class="asubj-num">{{ s.bookCount | number }}</td>
                  <td class="asubj-num">{{ s.lastBookNumber != null ? s.lastBookNumber + 1 : 1 }}</td>
                  <td class="asubj-actions">
                    <button class="asubj-btn" (click)="openEdit(s)">Edit</button>
                    <button class="asubj-btn asubj-btn--danger" (click)="deleteSubject(s)"
                            [disabled]="s.bookCount > 0"
                            [title]="s.bookCount > 0 ? 'Has holdings — cannot delete' : 'Delete subject'">
                      Delete
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      @if (editTarget() || isAdding()) {
        <div class="asubj-backdrop" (click)="closeDialog()"></div>
        <div class="asubj-dialog">
          <div class="asubj-dialog-title">{{ isAdding() ? 'Add Subject' : 'Edit Subject' }}</div>
          <div class="edit-field">
            <label class="edit-field-label">Term</label>
            <input class="edit-input" [ngModel]="dialogTerm()" (ngModelChange)="dialogTerm.set($event)"
                   placeholder="e.g. History" />
          </div>
          <div class="edit-row">
            <div class="edit-field">
              <label class="edit-field-label">Prefix</label>
              <input class="edit-input edit-input--sm" [ngModel]="dialogPrefix()"
                     (ngModelChange)="dialogPrefix.set($event.toUpperCase())"
                     placeholder="e.g. A" style="width:80px" />
            </div>
            <div class="edit-field edit-field--grow">
              <label class="edit-field-label">Next book #</label>
              <input class="edit-input edit-input--sm" type="number" min="1"
                     [ngModel]="dialogNext()" (ngModelChange)="dialogNext.set(+$event)" />
            </div>
          </div>
          <div class="asubj-dialog-actions">
            <button class="edit-btn edit-btn--cancel" (click)="closeDialog()">Cancel</button>
            <button class="edit-btn edit-btn--save" (click)="save()"
                    [disabled]="dialogSaving() || !dialogTerm().trim() || !dialogPrefix().trim()">
              {{ dialogSaving() ? '…' : 'Save' }}
            </button>
          </div>
        </div>
      }

    </div>
  `,
})
export class AdminSubjectsComponent implements OnInit {
  private http = inject(HttpClient);

  subjects = signal<SubjectRow[]>([]);
  loading = signal(true);

  editTarget = signal<SubjectRow | null>(null);
  isAdding = signal(false);
  dialogTerm = signal('');
  dialogPrefix = signal('');
  dialogNext = signal<number>(1);
  dialogSaving = signal(false);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<SubjectRow[]>(`${API}/subjects`).subscribe({
      next: rows => { this.subjects.set(rows); this.loading.set(false); },
    });
  }

  openEdit(s: SubjectRow) {
    this.editTarget.set(s);
    this.isAdding.set(false);
    this.dialogTerm.set(s.term);
    this.dialogPrefix.set(s.prefix);
    this.dialogNext.set(s.lastBookNumber != null ? s.lastBookNumber + 1 : 1);
  }

  openAdd() {
    this.editTarget.set(null);
    this.isAdding.set(true);
    this.dialogTerm.set('');
    this.dialogPrefix.set('');
    this.dialogNext.set(1);
  }

  closeDialog() {
    this.editTarget.set(null);
    this.isAdding.set(false);
  }

  save() {
    const term = this.dialogTerm().trim();
    const prefix = this.dialogPrefix().trim().toUpperCase();
    const lastBookNumber = Math.max(0, this.dialogNext() - 1);
    const body = { term, prefix, lastBookNumber };

    this.dialogSaving.set(true);
    const target = this.editTarget();
    const req = target
      ? this.http.put(`${API}/subjects/${target.id}`, body)
      : this.http.post(`${API}/subjects`, body);

    req.subscribe({
      next: () => { this.load(); this.closeDialog(); this.dialogSaving.set(false); },
      error: () => this.dialogSaving.set(false),
    });
  }

  deleteSubject(s: SubjectRow) {
    if (!confirm(`Delete subject "${s.term}"? This cannot be undone.`)) return;
    this.http.delete(`${API}/subjects/${s.id}`).subscribe({
      next: () => this.load(),
    });
  }
}
