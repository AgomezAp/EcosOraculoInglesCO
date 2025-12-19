import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, throwError } from 'rxjs';
import { environment } from '../environments/environments';

export interface LoveExpert {
  name: string;
  title: string;
  specialty: string;
  description: string;
  services: string[];
}

export interface LoveExpertInfo {
  success: boolean;
  loveExpert: LoveExpert;
  timestamp: string;
}

export interface LoveCalculatorData {
  name: string;
  specialty: string;
  experience: string;
}

export interface LoveCalculatorRequest {
  loveCalculatorData: LoveCalculatorData;
  userMessage: string;
  person1Name?: string;
  person1BirthDate?: string;
  person2Name?: string;
  person2BirthDate?: string;
  conversationHistory?: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'love_expert';
  message: string;
  timestamp: Date;
  id?: string;
}

export interface LoveCalculatorResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp?: string;
  freeMessagesRemaining?: number; // ✅ NEW
  showPaywall?: boolean; // ✅ NEW
  paywallMessage?: string; // ✅ NEW
  isCompleteResponse?: boolean; // ✅ NEW
}

export interface CompatibilityData {
  person1Name: string;
  person1BirthDate: string;
  person2Name: string;
  person2BirthDate: string;
}

@Injectable({
  providedIn: 'root',
})
export class CalculadoraAmorService {
  private readonly apiUrl = `${environment.apiUrl}`;
  private conversationHistorySubject = new BehaviorSubject<
    ConversationMessage[]
  >([]);
  private compatibilityDataSubject =
    new BehaviorSubject<CompatibilityData | null>(null);

  public conversationHistory$ = this.conversationHistorySubject.asObservable();
  public compatibilityData$ = this.compatibilityDataSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Gets love expert information
   */
  getLoveExpertInfo(): Observable<LoveExpertInfo> {
    return this.http
      .get<LoveExpertInfo>(`${this.apiUrl}info`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Sends a message to the love expert
   */
  chatWithLoveExpert(
    userMessage: string,
    person1Name?: string,
    person1BirthDate?: string,
    person2Name?: string,
    person2BirthDate?: string,
    conversationHistory?: Array<{
      role: 'user' | 'love_expert';
      message: string;
    }>,
    messageCount?: number, // ✅ NEW
    isPremiumUser?: boolean // ✅ NEW
  ): Observable<LoveCalculatorResponse> {
    const currentHistory = this.conversationHistorySubject.value;

    const requestData: LoveCalculatorRequest = {
      loveCalculatorData: {
        name: 'Master Valentina',
        specialty: 'Numerological compatibility and relationship analysis',
        experience:
          'Decades analyzing compatibility through the numbers of love',
      },
      userMessage,
      person1Name,
      person1BirthDate,
      person2Name,
      person2BirthDate,
      conversationHistory: currentHistory,
    };

    return this.http
      .post<LoveCalculatorResponse>(`${this.apiUrl}chat`, requestData)
      .pipe(
        map((response: any) => {
          if (response.success && response.response) {
            // Add messages to conversation
            this.addMessageToHistory('user', userMessage);
            this.addMessageToHistory('love_expert', response.response);
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Calculates compatibility between two people
   */
  calculateCompatibility(
    compatibilityData: CompatibilityData
  ): Observable<LoveCalculatorResponse> {
    // Save compatibility data
    this.setCompatibilityData(compatibilityData);

    const message = `I want to know the compatibility between ${compatibilityData.person1Name} and ${compatibilityData.person2Name}. Please analyze our numerological compatibility.`;

    return this.chatWithLoveExpert(
      message,
      compatibilityData.person1Name,
      compatibilityData.person1BirthDate,
      compatibilityData.person2Name,
      compatibilityData.person2BirthDate
    );
  }

  /**
   * Gets relationship advice
   */
  getRelationshipAdvice(question: string): Observable<LoveCalculatorResponse> {
    const compatibilityData = this.compatibilityDataSubject.value;

    return this.chatWithLoveExpert(
      question,
      compatibilityData?.person1Name,
      compatibilityData?.person1BirthDate,
      compatibilityData?.person2Name,
      compatibilityData?.person2BirthDate
    );
  }

  /**
   * Adds a message to conversation history
   */
  private addMessageToHistory(
    role: 'user' | 'love_expert',
    message: string
  ): void {
    const currentHistory = this.conversationHistorySubject.value;
    const newMessage: ConversationMessage = {
      role,
      message,
      timestamp: new Date(),
    };

    const updatedHistory = [...currentHistory, newMessage];
    this.conversationHistorySubject.next(updatedHistory);
  }

  /**
   * Sets compatibility data
   */
  setCompatibilityData(data: CompatibilityData): void {
    this.compatibilityDataSubject.next(data);
  }

  /**
   * Gets current compatibility data
   */
  getCompatibilityData(): CompatibilityData | null {
    return this.compatibilityDataSubject.value;
  }

  /**
   * Clears conversation history
   */
  clearConversationHistory(): void {
    this.conversationHistorySubject.next([]);
  }

  /**
   * Clears compatibility data
   */
  clearCompatibilityData(): void {
    this.compatibilityDataSubject.next(null);
  }

  /**
   * Resets the entire service
   */
  resetService(): void {
    this.clearConversationHistory();
    this.clearCompatibilityData();
  }

  /**
   * Gets current conversation history
   */
  getCurrentHistory(): ConversationMessage[] {
    return this.conversationHistorySubject.value;
  }

  /**
   * Checks if there is complete compatibility data
   */
  hasCompleteCompatibilityData(): boolean {
    const data = this.compatibilityDataSubject.value;
    return !!(
      data?.person1Name &&
      data?.person1BirthDate &&
      data?.person2Name &&
      data?.person2BirthDate
    );
  }

  /**
   * Formats a date for the backend
   */
  formatDateForBackend(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Validates compatibility data
   */
  validateCompatibilityData(data: Partial<CompatibilityData>): string[] {
    const errors: string[] = [];

    if (!data.person1Name?.trim()) {
      errors.push("First person's name is required");
    }

    if (!data.person1BirthDate?.trim()) {
      errors.push("First person's birth date is required");
    }

    if (!data.person2Name?.trim()) {
      errors.push("Second person's name is required");
    }

    if (!data.person2BirthDate?.trim()) {
      errors.push("Second person's birth date is required");
    }

    // Validate date formats
    if (data.person1BirthDate && !this.isValidDate(data.person1BirthDate)) {
      errors.push("First person's birth date is not valid");
    }

    if (data.person2BirthDate && !this.isValidDate(data.person2BirthDate)) {
      errors.push("Second person's birth date is not valid");
    }

    return errors;
  }

  /**
   * Checks if a date is valid
   */
  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Handles HTTP errors
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    console.error('Error in CalculadoraAmorService:', error);

    let errorMessage = 'Unknown error';
    let errorCode = 'UNKNOWN_ERROR';

    if (error.error?.error) {
      errorMessage = error.error.error;
      errorCode = error.error.code || 'API_ERROR';
    } else if (error.status === 0) {
      errorMessage =
        'Could not connect to the server. Please check your internet connection.';
      errorCode = 'CONNECTION_ERROR';
    } else if (error.status >= 400 && error.status < 500) {
      errorMessage = 'Request error. Please verify the data sent.';
      errorCode = 'CLIENT_ERROR';
    } else if (error.status >= 500) {
      errorMessage = 'Server error. Please try again later.';
      errorCode = 'SERVER_ERROR';
    }

    return throwError(() => ({
      message: errorMessage,
      code: errorCode,
      status: error.status,
    }));
  };
}
