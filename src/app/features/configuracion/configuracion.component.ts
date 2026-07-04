import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    const currentConfig = this.configService.config();
    this.configForm = this.fb.group({
      empresaNombre: [currentConfig.empresaNombre, Validators.required],
      rfc: [currentConfig.rfc, Validators.required],
      direccion: [currentConfig.direccion],
      telefono: [currentConfig.telefono],
      email: [currentConfig.email, [Validators.email]],
      logoUrl: [currentConfig.logoUrl]
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
}
