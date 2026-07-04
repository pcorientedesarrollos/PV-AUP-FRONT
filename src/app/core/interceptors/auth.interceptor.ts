import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();
  const sucursalId = authService.sesion()?.idSucursal;
  const empresaId = authService.sesion()?.empresa?.idEmpresa;
  const idPerfil = authService.sesion()?.idPerfil;

  let authReq = req;

  if (token) {
    let headers = authReq.headers.set('Authorization', `Bearer ${token}`);
    // Si NO es soporte (3), enviar cabeceras de filtro
    if (idPerfil !== 3) {
      if (sucursalId) {
        headers = headers.set('x-sucursal-id', sucursalId.toString());
      }
      if (empresaId) {
        headers = headers.set('x-empresa-id', empresaId.toString());
      }
    }
    authReq = authReq.clone({ headers });
  }

  return next(authReq).pipe(
    catchError((error) => {
      // 401 Unauthorized
      if (error.status === 401) {
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
