import { Component, Input, Output, EventEmitter, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { AuthService } from "../../../core/services/auth.service";
import { environment } from "../../../../environments/environment";

@Component({
  selector: "app-importar-modal",
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

          <div class="flex items-center justify-between p-6 border-b border-slate-200">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl">📥</div>
              <div>
                <h2 class="text-lg font-bold text-slate-800">Importar {{ etiqueta }}</h2>
                <p class="text-xs text-slate-500">desde archivo Excel o CSV</p>
              </div>
            </div>
            <button (click)="cerrar()" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">✕</button>
          </div>

          <div class="p-6 space-y-5">
            <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p class="text-sm font-semibold text-slate-700 mb-2">Paso 1 — Descarga la plantilla</p>
              <p class="text-xs text-slate-500 mb-3">Llénala con tus datos en Excel y guárdala.</p>
              <button (click)="descargarPlantilla()" class="flex items-center gap-2 bg-white border border-slate-300 hover:border-amber-400 hover:bg-amber-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-all shadow-sm">
                📄 Descargar Plantilla .xlsx
              </button>
            </div>

            <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p class="text-sm font-semibold text-slate-700 mb-2">Paso 2 — Sube tu archivo</p>
              <p class="text-xs text-slate-500 mb-3">Acepta .xlsx y .csv</p>
              <label class="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-xl cursor-pointer transition-colors bg-white hover:bg-amber-50">
                <span class="text-3xl mb-1">{{ archivoNombre() ? "✅" : "📂" }}</span>
                <span class="text-sm text-slate-600 font-medium">{{ archivoNombre() || "Haz clic para seleccionar" }}</span>
                <span class="text-xs text-slate-400 mt-1">{{ archivoNombre() ? "Archivo listo" : ".xlsx, .csv" }}</span>
                <input type="file" accept=".xlsx,.csv,.xls" class="hidden" (change)="onFileSelected($event)">
              </label>
            </div>

            @if (resultado()) {
              <div class="rounded-xl border p-4" [class]="resultado()!.errores.length === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xl">{{ resultado()!.errores.length === 0 ? "🎉" : "⚠️" }}</span>
                  <p class="font-bold text-slate-800">{{ resultado()!.importados }} {{ etiqueta }} importados</p>
                </div>
                @if (resultado()!.errores.length > 0) {
                  <p class="text-sm text-amber-700 font-medium mb-2">{{ resultado()!.errores.length }} filas con errores:</p>
                  <div class="max-h-32 overflow-y-auto space-y-1">
                    @for (e of resultado()!.errores; track e.fila) {
                      <div class="text-xs bg-white rounded-lg px-3 py-1.5 border border-amber-200 flex gap-2">
                        <span class="font-bold text-amber-600">Fila {{ e.fila }}:</span>
                        <span class="text-slate-600">{{ e.error }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            @if (importando()) {
              <div class="flex items-center justify-center gap-3 py-4">
                <div class="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <span class="text-sm text-slate-600 font-medium">Procesando archivo...</span>
              </div>
            }
          </div>

          <div class="flex items-center justify-end gap-3 p-6 pt-0">
            <button (click)="cerrar()" class="px-5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors">
              {{ resultado() ? "Cerrar" : "Cancelar" }}
            </button>
            @if (!resultado()) {
              <button (click)="importar()" [disabled]="!archivoSeleccionado() || importando()"
                class="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold transition-colors flex items-center gap-2">
                @if (importando()) { <span class="text-xs">Procesando...</span> } @else { <span>📥 Importar</span> }
              </button>
            }
          </div>
        </div>
      </div>
    }
  `
})
export class ImportarModalComponent {
  @Input() tipo: "productos" | "clientes" | "proveedores" = "productos";
  @Input() visible = false;
  @Output() cerrado = new EventEmitter<boolean>();

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  archivoSeleccionado = signal<File | null>(null);
  archivoNombre = signal("");
  importando = signal(false);
  resultado = signal<{ importados: number; errores: { fila: number; error: string }[] } | null>(null);

  get etiqueta() {
    return { productos: "productos", clientes: "clientes", proveedores: "proveedores" }[this.tipo];
  }

  get headers(): Record<string, string> {
    const s = this.auth.sesion() as any;
    const h: Record<string, string> = {};
    if (s?.idSucursal) h["x-sucursal-id"] = String(s.idSucursal);
    if (s?.idUsuario) h["x-usuario-id"] = String(s.idUsuario);
    return h;
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;
    this.archivoSeleccionado.set(file);
    this.archivoNombre.set(file.name);
    this.resultado.set(null);
  }

  descargarPlantilla() {
    fetch(`${environment.apiUrl}/pos/importar/plantilla/${this.tipo}`, { headers: this.headers })
      .then(r => r.blob())
      .then(blob => {
        const burl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = burl;
        a.download = `plantilla_${this.tipo}.xlsx`;
        a.click();
        URL.revokeObjectURL(burl);
      });
  }

  importar() {
    const archivo = this.archivoSeleccionado();
    if (!archivo) return;
    this.importando.set(true);
    const fd = new FormData();
    fd.append("archivo", archivo);
    this.http.post<{ importados: number; errores: { fila: number; error: string }[] }>(
      `${environment.apiUrl}/pos/importar/${this.tipo}`, fd, { headers: this.headers }
    ).subscribe({
      next: (res) => {
        this.importando.set(false);
        this.resultado.set(res);
        if (res.importados > 0) this.cerrado.emit(true);
      },
      error: (err) => {
        this.importando.set(false);
        this.resultado.set({ importados: 0, errores: [{ fila: 0, error: err?.error?.message || "Error de conexion" }] });
      }
    });
  }

  cerrar() {
    this.archivoSeleccionado.set(null);
    this.archivoNombre.set("");
    this.resultado.set(null);
    this.cerrado.emit(false);
  }
}
