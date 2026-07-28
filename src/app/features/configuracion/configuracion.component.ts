import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ConfigService, AppConfig } from '../../core/services/config.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './configuracion.component.html'
})
export class ConfiguracionComponent implements OnInit {
  configForm!: FormGroup;
  subiendoCsf = signal(false);

  constructor(
    private fb: FormBuilder,
    public configService: ConfigService,
    private toast: ToastService,
    private http: HttpClient
  ) {
    effect(() => {
      const currentConfig = this.configService.config();
      if (this.configForm) {
        this.configForm.patchValue(currentConfig, { emitEvent: false });
      }
    });
  }

  ngOnInit() {
    const currentConfig = this.configService.config();
    this.configForm = this.fb.group({
      empresaNombre: [currentConfig.empresaNombre, Validators.required],
      rfc: [currentConfig.rfc, Validators.required],
      direccion: [currentConfig.direccion],
      telefono: [currentConfig.telefono],
      email: [currentConfig.email, [Validators.email]],
      logoUrl: [currentConfig.logoUrl],
      ivaPorDefecto: [currentConfig.ivaPorDefecto, [Validators.required, Validators.min(0), Validators.max(100)]]
    });
  }

  guardar() {
    if (this.configForm.valid) {
      const newConfig: AppConfig = this.configForm.value;
      this.configService.saveConfig(newConfig);
      this.toast.show('Los cambios se han aplicado exitosamente.', 'success');
    } else {
      this.toast.show('Por favor, revisa los campos requeridos.', 'error');
      this.configForm.markAllAsTouched();
    }
  }

  restaurarPredeterminados() {
    this.configService.saveConfig(this.configService.defaultConfig);
    this.configForm.patchValue(this.configService.defaultConfig);
    this.toast.show('Se han restaurado los valores por defecto.', 'info');
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        this.toast.show('La imagen es muy grande. El tamaño máximo es 2MB.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.configForm.patchValue({ logoUrl: e.target.result });
      };
      reader.readAsDataURL(file);
    }
  }

  removerLogo() {
    this.configForm.patchValue({ logoUrl: '/logo.png' });
  }

  onCsfSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.subiendoCsf.set(true);
    const fd = new FormData();
    fd.append('file', file);

    this.http.post<any>(`${environment.apiUrl}/pos/utils/parse-csf`, fd).subscribe({
      next: (res) => {
        this.subiendoCsf.set(false);
        if (res.success) {
          this.configForm.patchValue({
            empresaNombre: res.nombre || this.configForm.value.empresaNombre,
            rfc: res.rfc || this.configForm.value.rfc,
            direccion: res.direccion ? `${res.direccion}${res.cp ? ', CP ' + res.cp : ''}` : this.configForm.value.direccion
          });
          this.toast.show('Datos fiscales extraídos correctamente.', 'success');
        } else {
          this.toast.show('Error al leer Cédula: ' + (res.error || 'Formato no reconocido'), 'error');
        }
        // Reset file input so it can be re-selected if needed
        event.target.value = '';
      },
      error: () => {
        this.subiendoCsf.set(false);
        this.toast.show('Error conectando al servidor para procesar la Cédula.', 'error');
        event.target.value = '';
      }
    });
  }
}
