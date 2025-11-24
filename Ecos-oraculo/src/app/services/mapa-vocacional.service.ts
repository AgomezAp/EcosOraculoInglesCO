import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from '../environments/environments';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface VocationalData {
  name: string;
  specialty: string;
  experience: string;
}

interface VocationalRequest {
  vocationalData: VocationalData;
  userMessage: string;
  personalInfo?: {
    age?: number;
    currentEducation?: string;
    workExperience?: string;
    interests?: string[];
  };
  assessmentAnswers?: Array<{
    question: string;
    answer: string;
    category: string;
  }>;
  conversationHistory?: Array<{
    role: 'user' | 'counselor';
    message: string;
  }>;
}

interface VocationalResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp?: string;
}

interface AssessmentQuestion {
  id: number;
  question: string;
  options: Array<{
    value: string;
    label: string;
    category: string;
  }>;
}

interface AssessmentQuestionsResponse {
  success: boolean;
  questions: AssessmentQuestion[];
  instructions: string;
  timestamp: string;
}

interface CategoryAnalysis {
  category: string;
  count: number;
  percentage: number;
}

interface VocationalProfile {
  name: string;
  description: string;
  characteristics: string[];
  workEnvironments: string[];
}

interface AnalysisResult {
  profileDistribution: CategoryAnalysis[];
  dominantProfile: VocationalProfile;
  recommendations: string[];
}

interface AnalysisResponse {
  success: boolean;
  analysis: AnalysisResult;
  timestamp: string;
}

interface CounselorInfo {
  name: string;
  title: string;
  specialty: string;
  description: string;
  services: string[];
  methodology: string[];
}

interface CounselorInfoResponse {
  success: boolean;
  counselor: CounselorInfo;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class MapaVocacionalService {
  // ✅ CORREGIR: Usar solo la URL base
  private readonly API_URL = environment.apiUrl;

  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
    }),
  };

  constructor(private http: HttpClient) {}

  /**
   * Envía un mensaje al consejero vocacional
   */
  sendMessage(
    userMessage: string,
    personalInfo?: any,
    assessmentAnswers?: any[],
    conversationHistory?: Array<{role: 'user' | 'counselor', message: string}>
  ): Observable<string> {
    const counselorData: VocationalData = {
      name: "Dr. Mentor Vocationis",
      specialty: "Orientación profesional y mapas vocacionales personalizados",
      experience: "Décadas de experiencia en psicología vocacional"
    };

    const requestBody: VocationalRequest = {
      vocationalData: counselorData,
      userMessage,
      personalInfo,
      assessmentAnswers,
      conversationHistory
    };

    // ✅ CORREGIR: URL exacta según backend
    return this.http.post<VocationalResponse>(
      `${this.API_URL}api/vocational/counselor`,
      requestBody,
      this.httpOptions
    ).pipe(
      map((response:any) => {
        if (response.success && response.response) {
          return response.response;
        } else {
          throw new Error(response.error || 'Error desconocido del consejero vocacional');
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene información del consejero vocacional
   */
  getCounselorInfo(): Observable<CounselorInfo> {
    // ✅ CORREGIR: URL exacta según backend
    return this.http.get<CounselorInfoResponse>(
      `${this.API_URL}/api/vocational/counselor/info`,
      this.httpOptions
    ).pipe(
      map((response:any) => {
        if (response.success && response.counselor) {
          return response.counselor;
        } else {
          throw new Error('Error al obtener información del consejero');
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene las preguntas del assessment vocacional
   */
  getAssessmentQuestions(): Observable<AssessmentQuestion[]> {
    // ✅ CORREGIR: URL exacta según backend
    return this.http.get<AssessmentQuestionsResponse>(
      `${this.API_URL}api/vocational/assessment/questions`,
      this.httpOptions
    ).pipe(
      map((response:any) => {
        if (response.success && response.questions) {
          return response.questions;
        } else {
          throw new Error('Error al obtener preguntas del assessment');
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Analiza las respuestas del assessment vocacional
   */
  analyzeAssessment(answers: Array<{question: string, answer: string, category: string}>): Observable<AnalysisResult> {
    const requestBody = { answers };

    // ✅ CORREGIR: URL exacta según backend
    return this.http.post<AnalysisResponse>(
      `${this.API_URL}api/vocational/assessment/analyze`,
      requestBody,
      this.httpOptions
    ).pipe(
      map((response:any) => {
        if (response.success && response.analysis) {
          return response.analysis;
        } else {
          throw new Error('Error al analizar el assessment');
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Prueba la conexión con el servicio vocacional
   */
  testConnection(): Observable<any> {
    // ✅ CORREGIR: URL exacta según backend
    return this.http.get(`${this.API_URL}api/vocational/test`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Manejo de errores HTTP
   */
  private handleError = (error: any): Observable<never> => {
    let errorMessage = 'Error desconocido';
    
    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del servidor
      errorMessage = error.error?.error || error.message || `Error HTTP: ${error.status}`;
    }
    
    console.error('Error en MapaVocacionalService:', errorMessage);
    return throwError(() => new Error(errorMessage));
  };
}