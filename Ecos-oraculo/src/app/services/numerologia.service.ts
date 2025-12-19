import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, timeout } from 'rxjs';
import { environment } from '../environments/environments';
// ✅ Interface for numerologist data
interface NumerologyData {
  name: string;
  title?: string;
  specialty: string;
  experience: string;
}

// ✅ Request Interface - EXPORTED
export interface NumerologyRequest {
  numerologyData: NumerologyData;
  userMessage: string;
  birthDate?: string;
  fullName?: string;
  conversationHistory?: Array<{
    role: 'user' | 'numerologist';
    message: string;
  }>;
  messageCount?: number;
  isPremiumUser?: boolean;
}

// ✅ Response Interface - EXPORTED
export interface NumerologyResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp?: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

// ✅ Interface for numerologist information - EXPORTED
export interface NumerologyInfo {
  success: boolean;
  numerologist: {
    name: string;
    title: string;
    specialty: string;
    description: string;
    services: string[];
  };
  freeMessagesLimit?: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class NumerologiaService {
  private appUrl: string;
  private apiUrl: string;

  // Default numerologist data
  private defaultNumerologyData: NumerologyData = {
    name: 'Master Sophia',
    title: 'Guardian of the Sacred Numbers',
    specialty: 'Pythagorean numerology',
    experience:
      'Decades of experience in the numerical vibrations of the universe',
  };

  constructor(private http: HttpClient) {
    this.appUrl = environment.apiUrl;
    this.apiUrl = 'api/numerology';
  }

  /**
   * ✅ MAIN METHOD: Send message with message counter
   */
  sendMessageWithCount(
    userMessage: string,
    messageCount: number,
    isPremiumUser: boolean,
    birthDate?: string,
    fullName?: string,
    conversationHistory?: Array<{
      role: 'user' | 'numerologist';
      message: string;
    }>
  ): Observable<NumerologyResponse> {
    const request: NumerologyRequest = {
      numerologyData: this.defaultNumerologyData,
      userMessage: userMessage.trim(),
      birthDate,
      fullName,
      conversationHistory,
      messageCount,
      isPremiumUser,
    };

    console.log('📤 Sending message to numerologist:', {
      messageCount: request.messageCount,
      isPremiumUser: request.isPremiumUser,
      userMessage: request.userMessage.substring(0, 50) + '...',
    });

    return this.http
      .post<NumerologyResponse>(
        `${this.appUrl}${this.apiUrl}/numerologist`,
        request
      )
      .pipe(
        timeout(60000),
        map((response: NumerologyResponse) => {
          console.log('📥 Numerologist response:', {
            success: response.success,
            freeMessagesRemaining: response.freeMessagesRemaining,
            showPaywall: response.showPaywall,
            isCompleteResponse: response.isCompleteResponse,
          });

          if (response.success) {
            return response;
          }
          throw new Error(response.error || 'Invalid server response');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error in communication with numerologist:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as NumerologyResponse);
        })
      );
  }

  /**
   * Legacy method for compatibility
   */
  sendMessage(
    userMessage: string,
    birthDate?: string,
    fullName?: string,
    conversationHistory?: Array<{
      role: 'user' | 'numerologist';
      message: string;
    }>
  ): Observable<string> {
    const request: NumerologyRequest = {
      numerologyData: this.defaultNumerologyData,
      userMessage: userMessage.trim(),
      birthDate,
      fullName,
      conversationHistory,
      messageCount: 1,
      isPremiumUser: false,
    };

    console.log(
      'Sending message to numerologist (legacy):',
      this.apiUrl + '/numerologist'
    );

    return this.http
      .post<NumerologyResponse>(
        `${this.appUrl}${this.apiUrl}/numerologist`,
        request
      )
      .pipe(
        timeout(30000),
        map((response: NumerologyResponse) => {
          console.log('Numerologist response:', response);
          if (response.success && response.response) {
            return response.response;
          }
          throw new Error(response.error || 'Invalid server response');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error in communication with numerologist:', error);
          return of(this.getErrorMessage(error));
        })
      );
  }

  /**
   * Get numerologist information
   */
  getNumerologyInfo(): Observable<NumerologyInfo> {
    return this.http
      .get<NumerologyInfo>(`${this.appUrl}${this.apiUrl}/numerologist/info`)
      .pipe(
        timeout(10000),
        catchError((error: HttpErrorResponse) => {
          console.error('Error getting numerologist info:', error);
          return of({
            success: false,
            numerologist: {
              name: 'Master Sophia',
              title: 'Guardian of the Sacred Numbers',
              specialty: 'Pythagorean numerology',
              description: 'Error connecting to the numerologist',
              services: [],
            },
            freeMessagesLimit: 3,
            timestamp: new Date().toISOString(),
          } as NumerologyInfo);
        })
      );
  }

  /**
   * Test connection with the backend
   */
  testConnection(): Observable<any> {
    return this.http.get(`${this.appUrl}api/health`).pipe(
      timeout(5000),
      catchError((error: HttpErrorResponse) => {
        console.error('Connection error:', error);
        return of({
          success: false,
          error: 'Cannot connect to the numerology service',
        });
      })
    );
  }

  /**
   * Calculate life path number
   */
  calculateLifePath(birthDate: string): number {
    try {
      const numbers = birthDate.replace(/\D/g, '');
      const sum = numbers
        .split('')
        .reduce((acc, digit) => acc + parseInt(digit), 0);
      return this.reduceToSingleDigit(sum);
    } catch {
      return 0;
    }
  }

  /**
   * Calculate destiny number based on name
   */
  calculateDestinyNumber(name: string): number {
    const letterValues: { [key: string]: number } = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      E: 5,
      F: 6,
      G: 7,
      H: 8,
      I: 9,
      J: 1,
      K: 2,
      L: 3,
      M: 4,
      N: 5,
      O: 6,
      P: 7,
      Q: 8,
      R: 9,
      S: 1,
      T: 2,
      U: 3,
      V: 4,
      W: 5,
      X: 6,
      Y: 7,
      Z: 8,
    };

    const sum = name
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .split('')
      .reduce((acc, letter) => {
        return acc + (letterValues[letter] || 0);
      }, 0);

    return this.reduceToSingleDigit(sum);
  }

  /**
   * Get basic interpretation of a number
   */
  getNumberMeaning(number: number): string {
    const meanings: { [key: number]: string } = {
      1: 'Leadership, independence, pioneer',
      2: 'Cooperation, diplomacy, sensitivity',
      3: 'Creativity, communication, expression',
      4: 'Stability, hard work, organization',
      5: 'Freedom, adventure, change',
      6: 'Responsibility, care, harmony',
      7: 'Spirituality, introspection, analysis',
      8: 'Material power, ambition, achievements',
      9: 'Humanitarianism, compassion, wisdom',
      11: 'Inspiration, intuition, illumination (Master Number)',
      22: 'Master builder, practical vision (Master Number)',
      33: 'Master healer, service to humanity (Master Number)',
    };

    return meanings[number] || 'Unrecognized number';
  }

  /**
   * Helper method to reduce to single digit
   */
  private reduceToSingleDigit(num: number): number {
    while (num > 9 && num !== 11 && num !== 22 && num !== 33) {
      num = num
        .toString()
        .split('')
        .reduce((acc, digit) => acc + parseInt(digit), 0);
    }
    return num;
  }

  /**
   * HTTP error handling
   */
  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 429) {
      return 'You have made too many requests. Please wait a moment before continuing.';
    }

    if (error.status === 503) {
      return 'The service is temporarily unavailable. Please try again in a few minutes.';
    }

    if (error.status === 0) {
      return 'Cannot connect to the numerology master. Please try again in a few minutes.';
    }

    if (error.error?.code === 'RATE_LIMIT_EXCEEDED') {
      return 'Too many requests. Please wait a moment.';
    }

    if (error.error?.code === 'MISSING_NUMEROLOGY_DATA') {
      return 'Error in numerologist data. Please try again.';
    }

    if (error.error?.code === 'ALL_MODELS_UNAVAILABLE') {
      return 'All AI models are temporarily unavailable. Please try again in a few minutes.';
    }

    return 'Sorry, the numerological energies are blocked at this moment. I invite you to meditate and try again later.';
  }
}
