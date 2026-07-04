import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // idPerfil === 1 significa Administrador, 3 significa Soporte
  if (auth.sesion()?.idPerfil === 1 || auth.sesion()?.idPerfil === 3) {
    return true;
  }

  // Redirigir al inicio/dashboard si no es administrador ni soporte
  router.navigate(['/home']);
  return false;
};
