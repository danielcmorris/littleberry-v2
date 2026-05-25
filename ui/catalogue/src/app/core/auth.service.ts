import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export type UserRole = 'public' | 'member' | 'staff' | 'admin';

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  role: UserRole;
}

const CLIENT_ID = '682935653385-l3t4gfu926e275h7plc8vj36968ve0r6.apps.googleusercontent.com';
const RETURN_KEY = 'lb_return_url';
const USER_KEY = 'lb_user';
const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  user = signal<AuthUser | null>(this.loadUser());

  isStaffOrAdmin = computed(() => {
    const r = this.user()?.role;
    return r === 'staff' || r === 'admin';
  });

  login(returnUrl = '/') {
    if (returnUrl !== '/') localStorage.setItem(RETURN_KEY, returnUrl);
    const nonce = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${window.location.origin}/callback`,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  handleCallback(hash: string): string {
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const idToken = params.get('id_token');
    if (!idToken) throw new Error('No id_token in callback');
    const user = this.decodeJwt(idToken);
    this.user.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    const returnUrl = localStorage.getItem(RETURN_KEY) ?? '/';
    localStorage.removeItem(RETURN_KEY);
    return returnUrl;
  }

  fetchRole(): Observable<void> {
    const u = this.user();
    if (!u) return of(undefined);
    return this.http.post<{ role: UserRole }>(`${API}/auth/me`, {
      sub: u.sub, email: u.email, name: u.name, picture: u.picture,
    }).pipe(
      tap(r => {
        const updated: AuthUser = { ...u, role: r.role };
        this.user.set(updated);
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
      }),
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  logout() {
    this.user.set(null);
    localStorage.removeItem(USER_KEY);
  }

  private loadUser(): AuthUser | null {
    try {
      const s = localStorage.getItem(USER_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  private decodeJwt(token: string): AuthUser {
    const b64url = token.split('.')[1];
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '=='.slice((b64.length + 3) % 4);
    const payload = JSON.parse(atob(padded));
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture ?? null,
      role: 'public',
    };
  }
}
