import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, timeout } from 'rxjs';
import { environment } from '../environments/environments';

export interface DreamInterpreterData {
  name: string;
  title?: string;
  specialty: string;
  experience: string;
}

export interface ConversationMessage {
  role: 'user' | 'interpreter';
  message: string;
  timestamp: Date | string;
  id?: string;
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  isCompleteResponse?: boolean;
  isPrizeAnnouncement?: boolean;
}

export interface DreamChatRequest {
  interpreterData: DreamInterpreterData;
  userMessage: string;
  conversationHistory?: ConversationMessage[];
  // ✅ NEW FIELDS for the 3 free messages system
  messageCount?: number;
  isPremiumUser?: boolean;
}

export interface DreamChatResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp: string;
  // ✅ NEW FIELDS returned by the backend
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

export interface InterpreterInfo {
  success: boolean;
  interpreter: {
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
export class InterpretadorSuenosService {
  private apiUrl = `${environment.apiUrl}`;

  // Default interpreter data
  private defaultInterpreterData: DreamInterpreterData = {
    name: 'Master Alma',
    title: 'Guardian of Dreams',
    specialty: 'Dream interpretation and dream symbolism',
    experience:
      'Centuries of experience interpreting messages from the subconscious',
  };

  constructor(private http: HttpClient) {}

  /**
   * ✅ MAIN METHOD: Send message with message counter
   */
  chatWithInterpreterWithCount(
    userMessage: string,
    messageCount: number,
    isPremiumUser: boolean,
    conversationHistory?: ConversationMessage[]
  ): Observable<DreamChatResponse> {
    const request: DreamChatRequest = {
      interpreterData: this.defaultInterpreterData,
      userMessage: userMessage.trim(),
      conversationHistory,
      messageCount,
      isPremiumUser,
    };

    console.log('📤 Sending dream message:', {
      messageCount: request.messageCount,
      isPremiumUser: request.isPremiumUser,
      userMessage: request.userMessage.substring(0, 50) + '...',
    });

    return this.http
      .post<DreamChatResponse>(`${this.apiUrl}interpretador-sueno`, request)
      .pipe(
        timeout(60000),
        map((response: DreamChatResponse) => {
          console.log('📥 Dream response:', {
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
          console.error('Error in communication with interpreter:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as DreamChatResponse);
        })
      );
  }

  /**
   * Legacy method for compatibility
   */
  chatWithInterpreter(
    request: DreamChatRequest
  ): Observable<DreamChatResponse> {
    const fullRequest: DreamChatRequest = {
      ...request,
      interpreterData: request.interpreterData || this.defaultInterpreterData,
      messageCount: request.messageCount || 1,
      isPremiumUser: request.isPremiumUser || false,
    };

    return this.http
      .post<DreamChatResponse>(`${this.apiUrl}interpretador-sueno`, fullRequest)
      .pipe(
        timeout(30000),
        catchError((error: HttpErrorResponse) => {
          console.error('Error in chatWithInterpreter:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as DreamChatResponse);
        })
      );
  }

  /**
   * Get interpreter information
   */
  getInterpreterInfo(): Observable<InterpreterInfo> {
    return this.http
      .get<InterpreterInfo>(`${this.apiUrl}interpretador-sueno/info`)
      .pipe(
        timeout(10000),
        catchError((error: HttpErrorResponse) => {
          console.error('Error getting interpreter info:', error);
          return of({
            success: false,
            interpreter: {
              name: 'Master Alma',
              title: 'Guardian of Dreams',
              specialty: 'Dream interpretation and dream symbolism',
              description: 'Error connecting to the interpreter',
              services: [],
            },
            freeMessagesLimit: 3,
            timestamp: new Date().toISOString(),
          } as InterpreterInfo);
        })
      );
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
      return 'Cannot connect to the dream interpreter. Please try again in a few minutes.';
    }

    if (error.error?.code === 'RATE_LIMIT_EXCEEDED') {
      return 'Too many requests. Please wait a moment.';
    }

    if (error.error?.code === 'ALL_MODELS_UNAVAILABLE') {
      return 'All AI models are temporarily unavailable. Please try again in a few minutes.';
    }

    return 'Sorry, the dream energies are disturbed at this moment. Please try again later.';
  }
}
