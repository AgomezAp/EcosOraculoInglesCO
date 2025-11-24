import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environments';

export interface PayPalOrderData {
  amount: string;
  currency: string;
  serviceName: string;
  returnPath: string;
  cancelPath: string;
}

export interface PayPalOrderResponse {
  orderId?: string;
  approvalUrl?: string;
  id?: string;
  status?: string;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface PayPalVerificationResponse {
  valid: boolean;
  status: string;
  orderId?: string;
  amount?: string;
  currency?: string;
}

export interface PaymentStatus {
  status: string;
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaypalService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Inicia el flujo de pago de PayPal
   * @param orderData Datos de la orden
   * @returns Promise que redirige al usuario a PayPal
   */
  async initiatePayment(orderData: PayPalOrderData): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.post<PayPalOrderResponse>(
          `${this.apiUrl}api/paypal/create-order`,
          orderData
        )
      );

      // Buscar la URL de aprobación en la respuesta
      let approvalUrl: string | undefined;

      // Opción 1: approvalUrl directamente en la respuesta
      if (response.approvalUrl) {
        approvalUrl = response.approvalUrl;
      }
      // Opción 2: Buscar en el array de links
      else if (response.links && response.links.length > 0) {
        const approveLink = response.links.find(link => link.rel === 'approve');
        if (approveLink) {
          approvalUrl = approveLink.href;
        }
      }

      if (approvalUrl) {
        // Redirigir al usuario a PayPal
        window.location.href = approvalUrl;
      } else {
        console.error('Respuesta completa del backend:', response);
        throw new Error('No se recibió la URL de aprobación de PayPal');
      }
    } catch (error: any) {
      console.error('Error al iniciar pago de PayPal:', error);
      throw new Error(
        error.message || 'Error al procesar el pago con PayPal'
      );
    }
  }

  /**
   * Verifica y procesa un pago después de que el usuario regrese de PayPal
   * @param token Token de PayPal de la URL
   * @returns Información de verificación del pago
   */
  async verifyAndProcessPayment(token: string): Promise<PayPalVerificationResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<PayPalVerificationResponse>(
          `${this.apiUrl}api/paypal/capture-order`,
          { token }
        )
      );

      return response;
    } catch (error: any) {
      console.error('Error al verificar pago de PayPal:', error);
      throw new Error(
        error.message || 'Error al verificar el pago con PayPal'
      );
    }
  }

  /**
   * Verifica el estado del pago desde la URL después del retorno de PayPal
   * @returns Estado del pago o null si no hay parámetros
   */
  checkPaymentStatusFromUrl(): PaymentStatus | null {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const paymentId = urlParams.get('PayerID');

    if (token && paymentId) {
      return {
        status: 'COMPLETED',
        token: token
      };
    }

    // Verificar si fue cancelado
    const cancelled = urlParams.get('cancelled');
    if (cancelled === 'true') {
      return {
        status: 'CANCELLED',
        token: ''
      };
    }

    return null;
  }

  /**
   * Limpia los parámetros de PayPal de la URL
   */
  clearPaymentParams(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    url.searchParams.delete('PayerID');
    url.searchParams.delete('cancelled');
    window.history.replaceState({}, document.title, url.pathname);
  }
}
