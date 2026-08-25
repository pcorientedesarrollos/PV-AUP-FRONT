import { inject } from '@angular/core';
import { Routes, Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';

import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { soporteGuard } from './core/guards/soporte.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'pos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pos/pos.component').then((m) => m.PosComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.DashboardComponent),
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        loadComponent: () =>
          import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'diagnostico',
        canActivate: [soporteGuard],
        loadComponent: () =>
          import('./features/diagnostico/diagnostico.component').then((m) => m.DiagnosticoComponent),
      },
      {
        path: 'historial',
        loadComponent: () =>
          import('./features/historial/historial.component').then((m) => m.HistorialComponent),
      },
      {
        path: 'corte-caja',
        loadComponent: () =>
          import('./features/corte-caja/corte-caja.component').then((m) => m.CorteCajaComponent),
      },
      {
        path: 'sucursales',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/sucursales/sucursales.component').then((m) => m.SucursalesComponent),
      },
      {
        path: 'empresas',
        canActivate: [soporteGuard],
        loadComponent: () =>
          import('./features/empresas/empresas.component').then((m) => m.EmpresasComponent),
      },
      {
        path: 'cotizaciones',
        loadComponent: () =>
          import('./features/cotizaciones/cotizaciones').then((m) => m.CotizacionesComponent),
      },
      {
        path: 'cotizaciones/nueva',
        loadComponent: () =>
          import('./features/cotizaciones/nueva-cotizacion/nueva-cotizacion').then((m) => m.NuevaCotizacionComponent),
      },
      {
        path: 'compras',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/compras/compras.component').then((m) => m.ComprasComponent),
      },
      {
        path: 'compras/nueva',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/compras/nueva-compra.component').then((m) => m.NuevaCompraComponent),
      },
      {
        path: 'productos',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/productos/productos.component').then((m) => m.ProductosComponent),
      },
      {
        path: 'categorias',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/categorias/categorias.component').then((m) => m.CategoriasComponent),
      },
      {
        path: 'inventario',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/inventario/inventario').then((m) => m.InventarioComponent),
      },
      {
        path: 'inventario/traspasos',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/inventario/traspasos/traspasos.component').then((m) => m.TraspasosComponent),
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./features/clientes/clientes.component').then((m) => m.ClientesComponent),
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
      },
      {
        path: 'configuracion',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/configuracion/configuracion.component').then((m) => m.ConfiguracionComponent),
      },
      {
        path: 'facturas',
        canActivate: [() => {
          const auth = inject(AuthService);
          if (auth.sesion()?.idPerfil === 1 || auth.sesion()?.idPerfil === 3 || auth.sesion()?.idPerfil === 2 || auth.tienePermiso('facturar')) return true;
          inject(Router).navigate(['/home']);
          return false;
        }],
        loadComponent: () =>
          import('./features/facturas/facturas.component').then((m) => m.FacturasComponent),
      },
      {
        path: 'proformas',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/proformas/proformas.component').then((m) => m.ProformasComponent),
      },
      {
        path: 'proveedores',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/proveedores/proveedores.component').then((m) => m.ProveedoresComponent),
      },
      {
        path: 'produccion',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/produccion/produccion.component').then((m) => m.ProduccionComponent),
      },
      {
        path: 'devoluciones',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/devoluciones/devoluciones.component').then((m) => m.DevolucionesComponent),
      }
    ]
  },
  {
    path: '**',
    redirectTo: '',
  },
];
