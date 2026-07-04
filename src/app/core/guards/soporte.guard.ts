import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const soporteGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.sesion()?.idPerfil === 3) {
    return true;
  }

  router.navigate(['/home']);
  return false;
};
