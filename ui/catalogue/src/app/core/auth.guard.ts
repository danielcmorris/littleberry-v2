import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.user()) return true;
  auth.login(state.url);
  return false;
};

export const staffGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const user = auth.user();
  if (!user) {
    auth.login(state.url);
    return false;
  }
  if (auth.isStaffOrAdmin()) return true;
  return inject(Router).createUrlTree(['/']);
};
