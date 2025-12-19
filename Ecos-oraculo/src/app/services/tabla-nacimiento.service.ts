import { Injectable } from '@angular/core';
import { environment } from '../environments/environments';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BirthChartRequest {
  chartData: {
    name: string;
    specialty: string;
    experience: string;
  };
  userMessage: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  fullName?: string;
  conversationHistory?: Array<{
    role: 'user' | 'astrologer';
    message: string;
  }>;
  // ✅ NEW FIELDS for the 3 free messages system
  messageCount?: number;
  isPremiumUser?: boolean;
}

export interface BirthChartResponse {
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

export interface AstrologerInfo {
  success: boolean;
  astrologer: {
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
  providedIn: 'root'
})
export class TablaNacimientoService {
  private apiUrl = `${environment.apiUrl}api/tabla-nacimiento`;

  constructor(private http: HttpClient) {}

  /**
   * ✅ MAIN METHOD: Send message with message counter
   */
  chatWithAstrologerWithCount(
    request: BirthChartRequest,
    messageCount: number,
    isPremiumUser: boolean
  ): Observable<BirthChartResponse> {
    const fullRequest: BirthChartRequest = {
      ...request,
      messageCount,
      isPremiumUser,
    };
    return this.http.post<BirthChartResponse>(`${this.apiUrl}/chat`, fullRequest);
  }

  /**
   * Legacy method for compatibility
   */
  chatWithAstrologer(request: BirthChartRequest): Observable<BirthChartResponse> {
    return this.http.post<BirthChartResponse>(`${this.apiUrl}/chat`, request);
  }

  getBirthChartInfo(): Observable<AstrologerInfo> {
    return this.http.get<AstrologerInfo>(`${this.apiUrl}/info`);
  }
}