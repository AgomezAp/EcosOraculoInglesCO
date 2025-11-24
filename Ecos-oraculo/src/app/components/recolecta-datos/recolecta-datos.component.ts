import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecolectaService } from '../../services/recolecta.service';
import { Datos } from '../../interfaces/datos';
import { StorageService } from '../../services/storage.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-recolecta-datos',
  imports: [CommonModule, FormsModule],
  templateUrl: './recolecta-datos.component.html',
  styleUrl: './recolecta-datos.component.css',
})
export class RecolectaDatosComponent {
  private storage = inject(StorageService);
  private logger = inject(LoggerService);
  
  // ✅ Eventos de salida
  @Output() onDataSubmitted = new EventEmitter<any>();
  @Output() onModalClosed = new EventEmitter<void>();
  constructor(private recolecta: RecolectaService) {}
  // ✅ Propiedades de datos
  userData: any = {
    importe: 7.0,
    email: '',
  };
  aceptaTerminos = false;
  showTerminosError = false;
  datosVeridicos = false;
  showDatosVeridicosError = false;
  emailNotifications = false;
  // ✅ Control de formulario
  dataFormErrors: { [key: string]: string } = {};
  isValidatingData: boolean = false;
  attemptedDataSubmission: boolean = false;

  // ✅ Método para validar datos
  validateUserData(): boolean {
    this.dataFormErrors = {};
    let isValid = true;
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.userData.email || !this.userData.email.toString().trim()) {
      this.dataFormErrors['email'] = 'Email is required';
      isValid = false;
    } else if (!emailRegex.test(this.userData.email.toString().trim())) {
      this.dataFormErrors['email'] = 'Enter a valid email';
      isValid = false;
    }
    return isValid;
  }

  // ✅ Método para verificar errores
  hasError(field: string): boolean {
    return this.attemptedDataSubmission && !!this.dataFormErrors[field];
  }

  // ✅ Método para limpiar error de un campo específico
  clearFieldError(field: string): void {
    if (this.dataFormErrors[field]) {
      delete this.dataFormErrors[field];
    }
  }

  async submitUserData(): Promise<void> {
    
    this.attemptedDataSubmission = true;

    // Validar formulario
    if (!this.validateUserData()) {
      return;
    }

    // Validar términos y condiciones
    this.showTerminosError = false;
    this.showDatosVeridicosError = false;

    if (!this.aceptaTerminos) {
      this.showTerminosError = true;
      return;
    }

    if (!this.datosVeridicos) {
      this.showDatosVeridicosError = true;
      return;
    }

    this.isValidatingData = true;

    try {
      // ✅ LIMPIAR Y NORMALIZAR DATOS ANTES DE ENVIAR
      const datosToSend: Datos = {
        email: (this.userData.email || '').toString().trim(),
      };

      // ✅ VALIDAR UNA VEZ MÁS LOS CAMPOS CRÍTICOS
      const camposCriticos = [ 'email', ];
      const faltantes = camposCriticos.filter(
        (campo) => !datosToSend[campo as keyof Datos]
      );

      if (faltantes.length > 0) {
      
        this.dataFormErrors[
          'general'
        ] = `Missing required fields. Unexpected error. Please try again: ${faltantes.join(', ')}`;
        this.isValidatingData = false;
        return;
      }

      // Guardar en sessionStorage
      this.storage.setUserData(datosToSend);

      // Verificar que se guardaron correctamente
      const verificacion = JSON.stringify(this.storage.getUserData());
      const datosGuardados = verificacion ? JSON.parse(verificacion) : null;

      // Llamar al servicio
      this.recolecta.createProduct(datosToSend).subscribe({
        next: (response: Datos) => {
          this.isValidatingData = false;
          this.onDataSubmitted.emit(datosToSend); // ✅ EMITIR datosToSend en lugar de response
        },
        error: (error: any) => {
          console.error('❌ Error del backend:', error); // DEBUG
          console.error('❌ Error completo:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            url: error.url,
            error: error.error,
          });

          // ✅ AUN ASÍ EMITIR LOS DATOS PARA CONTINUAR CON EL PAGO
        
          this.isValidatingData = false;
          this.onDataSubmitted.emit(datosToSend); // ✅ EMITIR datos locales
        },
      });
    } catch (error) {
      console.error('❌ Error inesperado:', error); // DEBUG
      this.dataFormErrors['general'] =
        'Unexpected error. Please try again.';
      this.isValidatingData = false;
    }
  }
  cancelDataModal(): void {
    this.onModalClosed.emit();
  }
}
