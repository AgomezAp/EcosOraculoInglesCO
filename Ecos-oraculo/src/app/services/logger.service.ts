import { Injectable } from '@angular/core';
import { environment } from '../environments/environments';

/**
 * Servicio centralizado de logging
 * Elimina logs en producción para mejorar performance
 */
@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private isDevelopment = !environment.production;

  /**
   * Log general - solo en desarrollo
   */
  log(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`[LOG] ${message}`, ...args);
    }
  }

  /**
   * Log de información - solo en desarrollo
   */
  info(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * Warning - siempre se muestra
   */
  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  /**
   * Error - siempre se muestra y puede enviarse a servicio de monitoreo
   */
  error(message: string, error?: any): void {
    console.error(`[ERROR] ${message}`, error);
    
    // TODO: Aquí podrías integrar con Sentry, LogRocket, etc.
    if (environment.production && error) {
      this.sendToMonitoringService(message, error);
    }
  }

  /**
   * Debug - solo en desarrollo
   */
  debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Log de performance - mide tiempo de ejecución
   */
  time(label: string): void {
    if (this.isDevelopment) {
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (this.isDevelopment) {
      console.timeEnd(label);
    }
  }

  /**
   * Log de tabla - útil para arrays de objetos
   */
  table(data: any): void {
    if (this.isDevelopment) {
      console.table(data);
    }
  }

  /**
   * Enviar errores a servicio de monitoreo en producción
   * @private
   */
  private sendToMonitoringService(message: string, error: any): void {
    // Implementar integración con servicio de monitoreo
    // Ejemplo: Sentry.captureException(error);
  }
}
