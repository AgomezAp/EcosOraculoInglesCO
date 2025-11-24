import { Injectable } from '@angular/core';
import { LoggerService } from './logger.service';

/**
 * Servicio centralizado para manejo de almacenamiento
 * Reduce código duplicado y mejora mantenibilidad
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {
  constructor(private logger: LoggerService) {}

  // ========== MÉTODOS GENÉRICOS ==========

  /**
   * Guardar item en sessionStorage con tipado genérico
   */
  setSessionItem<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      sessionStorage.setItem(key, serialized);
      this.logger.debug(`Session item saved: ${key}`);
    } catch (error) {
      this.logger.error(`Error saving session item: ${key}`, error);
    }
  }

  /**
   * Obtener item de sessionStorage con tipado genérico
   */
  getSessionItem<T>(key: string): T | null {
    try {
      const item = sessionStorage.getItem(key);
      if (!item) return null;
      
      return JSON.parse(item) as T;
    } catch (error) {
      this.logger.error(`Error reading session item: ${key}`, error);
      return null;
    }
  }

  /**
   * Guardar item en localStorage con tipado genérico
   */
  setLocalItem<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      this.logger.debug(`Local item saved: ${key}`);
    } catch (error) {
      this.logger.error(`Error saving local item: ${key}`, error);
    }
  }

  /**
   * Obtener item de localStorage con tipado genérico
   */
  getLocalItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      return JSON.parse(item) as T;
    } catch (error) {
      this.logger.error(`Error reading local item: ${key}`, error);
      return null;
    }
  }

  /**
   * Remover item de sessionStorage
   */
  removeSessionItem(key: string): void {
    try {
      sessionStorage.removeItem(key);
      this.logger.debug(`Session item removed: ${key}`);
    } catch (error) {
      this.logger.error(`Error removing session item: ${key}`, error);
    }
  }

  /**
   * Remover item de localStorage
   */
  removeLocalItem(key: string): void {
    try {
      localStorage.removeItem(key);
      this.logger.debug(`Local item removed: ${key}`);
    } catch (error) {
      this.logger.error(`Error removing local item: ${key}`, error);
    }
  }

  /**
   * Limpiar todo sessionStorage
   */
  clearSession(): void {
    try {
      sessionStorage.clear();
      this.logger.info('Session storage cleared');
    } catch (error) {
      this.logger.error('Error clearing session storage', error);
    }
  }

  /**
   * Limpiar todo localStorage
   */
  clearLocal(): void {
    try {
      localStorage.clear();
      this.logger.info('Local storage cleared');
    } catch (error) {
      this.logger.error('Error clearing local storage', error);
    }
  }

  // ========== MÉTODOS ESPECÍFICOS DE LA APP ==========

  /**
   * Obtener datos del usuario
   */
  getUserData(): any | null {
    return this.getSessionItem('userData');
  }

  /**
   * Guardar datos del usuario
   */
  setUserData(data: any): void {
    this.setSessionItem('userData', data);
  }

  /**
   * Verificar si el usuario ha pagado por un servicio
   */
  hasUserPaid(service: string): boolean {
    const key = `hasUserPaidFor${service}`;
    return sessionStorage.getItem(key) === 'true';
  }

  /**
   * Marcar que el usuario ha pagado por un servicio
   */
  setUserPaid(service: string, paid: boolean = true): void {
    const key = `hasUserPaidFor${service}`;
    sessionStorage.setItem(key, paid.toString());
    this.logger.info(`User payment status updated for ${service}: ${paid}`);
  }

  /**
   * Obtener mensajes guardados de un servicio
   */
  getMessages(serviceKey: string): any[] | null {
    return this.getSessionItem<any[]>(serviceKey);
  }

  /**
   * Guardar mensajes de un servicio
   */
  setMessages(serviceKey: string, messages: any[]): void {
    this.setSessionItem(serviceKey, messages);
  }

  /**
   * Obtener consultas gratuitas disponibles
   */
  getFreeConsultations(serviceKey: string): number {
    const key = `free${serviceKey}Consultations`;
    const value = sessionStorage.getItem(key);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Establecer consultas gratuitas disponibles
   */
  setFreeConsultations(serviceKey: string, count: number): void {
    const key = `free${serviceKey}Consultations`;
    sessionStorage.setItem(key, count.toString());
    this.logger.debug(`Free consultations set for ${serviceKey}: ${count}`);
  }

  /**
   * Incrementar consultas gratuitas
   */
  addFreeConsultations(serviceKey: string, count: number): void {
    const current = this.getFreeConsultations(serviceKey);
    const newTotal = current + count;
    this.setFreeConsultations(serviceKey, newTotal);
    this.logger.info(`Added ${count} free consultations for ${serviceKey}. Total: ${newTotal}`);
  }

  /**
   * Decrementar consultas gratuitas
   */
  useFreeConsultation(serviceKey: string): boolean {
    const current = this.getFreeConsultations(serviceKey);
    if (current > 0) {
      this.setFreeConsultations(serviceKey, current - 1);
      this.logger.info(`Used free consultation for ${serviceKey}. Remaining: ${current - 1}`);
      return true;
    }
    return false;
  }

  /**
   * Obtener tiradas de ruleta disponibles
   */
  getWheelSpins(): number {
    const value = sessionStorage.getItem('wheelSpins');
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Establecer tiradas de ruleta
   */
  setWheelSpins(count: number): void {
    sessionStorage.setItem('wheelSpins', count.toString());
  }

  /**
   * Verificar si puede mostrar la ruleta hoy
   */
  canShowWheelToday(): boolean {
    const lastSpin = localStorage.getItem('lastWheelSpinDate');
    if (!lastSpin) return true;

    const lastDate = new Date(lastSpin);
    const today = new Date();
    
    return lastDate.toDateString() !== today.toDateString();
  }

  /**
   * Marcar que se mostró la ruleta hoy
   */
  markWheelShownToday(): void {
    localStorage.setItem('lastWheelSpinDate', new Date().toISOString());
  }

  /**
   * Obtener mensaje bloqueado
   */
  getBlockedMessageId(service: string): string | null {
    return sessionStorage.getItem(`${service}BlockedMessageId`);
  }

  /**
   * Establecer mensaje bloqueado
   */
  setBlockedMessageId(service: string, messageId: string): void {
    sessionStorage.setItem(`${service}BlockedMessageId`, messageId);
  }

  /**
   * Remover mensaje bloqueado
   */
  removeBlockedMessageId(service: string): void {
    sessionStorage.removeItem(`${service}BlockedMessageId`);
  }

  /**
   * Verificar si es primera pregunta
   */
  isFirstQuestion(service: string): boolean {
    return sessionStorage.getItem(`${service}FirstQuestion`) !== 'true';
  }

  /**
   * Marcar primera pregunta como realizada
   */
  markFirstQuestionAsked(service: string): void {
    sessionStorage.setItem(`${service}FirstQuestion`, 'true');
  }

  // ========== MÉTODOS ESPECÍFICOS PARA SUEÑOS ==========

  /**
   * Verificar si el usuario ha pagado por interpretación de sueños
   */
  hasUserPaidForDreams(): boolean {
    return this.hasUserPaid('Dreams');
  }

  /**
   * Obtener mensajes de sueños guardados
   */
  getDreamMessages(): any[] | null {
    return this.getMessages('dreamMessages');
  }

  /**
   * Guardar mensajes de sueños
   */
  setDreamMessages(messages: any[]): void {
    this.setMessages('dreamMessages', messages);
  }

  /**
   * Limpiar datos de sesión de sueños
   */
  clearDreamSession(): void {
    this.removeSessionItem('dreamMessages');
    this.removeSessionItem('firstQuestionAsked');
    this.removeSessionItem('blockedMessageId');
    this.logger.info('Dream session data cleared');
  }
}
