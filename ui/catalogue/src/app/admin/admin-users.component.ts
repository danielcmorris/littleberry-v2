import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { UserRole } from '../core/auth.service';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  created_at: string;
  last_login: string | null;
}

const ROLES: UserRole[] = ['public', 'member', 'staff', 'admin'];

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  template: `
    <div class="admin-wrap">
      <div class="admin-header">
        <div class="admin-header-kicker"><a routerLink="/admin">Administration</a></div>
        <h1 class="admin-header-title">Users</h1>
        <button class="admin-header-action" (click)="openDialog()">+ Add User</button>
      </div>

      <div class="admin-users-table-wrap">
        @if (loading()) {
          <div class="admin-users-empty">Loading…</div>
        } @else if (users().length === 0) {
          <div class="admin-users-empty">No users yet.</div>
        } @else {
          <table class="admin-users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Last login</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              @for (u of users(); track u.id) {
                <tr class="admin-users-row" [class.admin-users-row--admin]="u.role === 'admin'">
                  <td class="admin-users-email">{{ u.email }}</td>
                  <td>{{ u.name ?? '—' }}</td>
                  <td>
                    <select class="admin-users-role-select" [value]="u.role"
                            (change)="changeRole(u, $event)">
                      @for (r of roles; track r) {
                        <option [value]="r" [selected]="r === u.role">{{ r }}</option>
                      }
                    </select>
                  </td>
                  <td class="admin-users-date">{{ u.last_login ? (u.last_login | date:'mediumDate') : '—' }}</td>
                  <td class="admin-users-date">{{ u.created_at | date:'mediumDate' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>

    @if (dialogOpen()) {
      <div class="asubj-overlay" (click)="closeDialog()"></div>
      <div class="asubj-dialog">
        <div class="asubj-dialog-title">Add User</div>

        <div class="edit-field">
          <label class="edit-field-label">Email *</label>
          <input class="edit-input" type="email" [(ngModel)]="newEmail"
                 placeholder="user@example.com" (keydown.enter)="submit()" autofocus />
        </div>

        <div class="edit-field">
          <label class="edit-field-label">Name</label>
          <input class="edit-input" type="text" [(ngModel)]="newName"
                 placeholder="Optional display name" (keydown.enter)="submit()" />
        </div>

        <div class="edit-field">
          <label class="edit-field-label">Role</label>
          <select class="edit-select" [(ngModel)]="newRole">
            @for (r of roles; track r) {
              <option [value]="r">{{ r }}</option>
            }
          </select>
        </div>

        @if (error()) {
          <div class="admin-users-error">{{ error() }}</div>
        }

        <div class="asubj-dialog-actions">
          <button class="edit-btn edit-btn--ghost" (click)="closeDialog()" [disabled]="saving()">Cancel</button>
          <button class="edit-btn edit-btn--primary" (click)="submit()" [disabled]="saving() || !newEmail.trim()">
            {{ saving() ? 'Adding…' : 'Add User' }}
          </button>
        </div>
      </div>
    }
  `,
})
export class AdminUsersComponent implements OnInit {
  private http = inject(HttpClient);

  users = signal<UserRow[]>([]);
  loading = signal(true);
  roles = ROLES;

  dialogOpen = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  newEmail = '';
  newName = '';
  newRole: UserRole = 'public';

  ngOnInit() {
    this.load();
  }

  load() {
    this.http.get<UserRow[]>(`${environment.apiUrl}/admin/users`).subscribe({
      next: rows => { this.users.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openDialog() {
    this.newEmail = '';
    this.newName = '';
    this.newRole = 'public';
    this.error.set(null);
    this.dialogOpen.set(true);
  }

  closeDialog() {
    if (this.saving()) return;
    this.dialogOpen.set(false);
  }

  submit() {
    const email = this.newEmail.trim();
    if (!email || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);

    this.http.post<UserRow>(`${environment.apiUrl}/admin/users`, {
      email,
      name: this.newName.trim() || null,
      role: this.newRole,
    }).subscribe({
      next: row => {
        this.users.update(list => [...list, row].sort((a, b) => a.email.localeCompare(b.email)));
        this.saving.set(false);
        this.dialogOpen.set(false);
      },
      error: err => {
        this.error.set(err.status === 409 ? 'A user with that email already exists.' : 'Failed to add user.');
        this.saving.set(false);
      },
    });
  }

  changeRole(user: UserRow, event: Event) {
    const role = (event.target as HTMLSelectElement).value as UserRole;
    this.http.put(`${environment.apiUrl}/admin/users/${user.id}/role`, { role }).subscribe({
      next: () => {
        this.users.update(list => list.map(u => u.id === user.id ? { ...u, role } : u));
      },
      error: () => this.load(),
    });
  }
}
