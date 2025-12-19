import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../environments/environments';
// ✅ Updated interfaces for the backend
export interface AstrologerData {
  name: string;
  title: string;
  specialty: string;
  experience: string;
}

export interface ZodiacRequest {
  zodiacData: AstrologerData;
  userMessage: string;
  birthDate?: string;
  zodiacSign?: string;
  conversationHistory?: Array<{
    role: 'user' | 'astrologer';
    message: string;
  }>;
  messageCount?: number;
  isPremiumUser?: boolean;
}

export interface ZodiacResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export interface AstrologerInfoResponse {
  success: boolean;
  astrologer: {
    name: string;
    title: string;
    specialty: string;
    description: string;
    services: string[];
  };
  freeMessagesLimit: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class InformacionZodiacoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Sends a message to the astrologer and receives a response
   */
  chatWithAstrologer(request: ZodiacRequest): Observable<ZodiacResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    return this.http
      .post<ZodiacResponse>(`${this.apiUrl}api/zodiac/chat`, request, {
        headers,
      })
      .pipe(
        timeout(60000), // 60 seconds timeout
        catchError((error) => {
          console.error('Error in chatWithAstrologer:', error);

          let errorMessage =
            'Error communicating with the astrologer. Please try again.';
          let errorCode = 'NETWORK_ERROR';

          if (error.status === 429) {
            errorMessage =
              'Too many requests. Please wait a moment before continuing.';
            errorCode = 'RATE_LIMIT';
          } else if (error.status === 503) {
            errorMessage =
              'The service is temporarily unavailable. Please try again in a few minutes.';
            errorCode = 'SERVICE_UNAVAILABLE';
          } else if (error.status === 400) {
            errorMessage =
              error.error?.error ||
              'Invalid request. Please check your message.';
            errorCode = error.error?.code || 'BAD_REQUEST';
          } else if (error.status === 401) {
            errorMessage = 'Authentication error with the service.';
            errorCode = 'AUTH_ERROR';
          } else if (error.name === 'TimeoutError') {
            errorMessage = 'The request took too long. Please try again.';
            errorCode = 'TIMEOUT';
          }

          return throwError(() => ({
            success: false,
            error: errorMessage,
            code: errorCode,
            timestamp: new Date().toISOString(),
          }));
        })
      );
  }

  /**
   * Gets astrologer information
   */
  getAstrologerInfo(): Observable<AstrologerInfoResponse> {
    return this.http
      .get<AstrologerInfoResponse>(`${this.apiUrl}api/zodiac/info`)
      .pipe(
        timeout(10000),
        catchError((error) => {
          console.error('Error in getAstrologerInfo:', error);
          return throwError(() => ({
            success: false,
            error: 'Error getting astrologer information',
            timestamp: new Date().toISOString(),
          }));
        })
      );
  }

  /**
   * Calculates the zodiac sign based on the birth date
   */
  calculateZodiacSign(birthDate: string): string {
    try {
      const date = new Date(birthDate);
      const month = date.getMonth() + 1;
      const day = date.getDate();

      if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
        return 'Aries ♈';
      if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
        return 'Taurus ♉';
      if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
        return 'Gemini ♊';
      if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
        return 'Cancer ♋';
      if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
        return 'Leo ♌';
      if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
        return 'Virgo ♍';
      if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
        return 'Libra ♎';
      if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
        return 'Scorpio ♏';
      if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
        return 'Sagittarius ♐';
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
        return 'Capricorn ♑';
      if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
        return 'Aquarius ♒';
      if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
        return 'Pisces ♓';

      return 'Unknown sign';
    } catch {
      return 'Invalid date';
    }
  }
}
