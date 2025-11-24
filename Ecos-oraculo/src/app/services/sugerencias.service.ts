import { Injectable } from '@angular/core';
import { environment } from '../environments/environments';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
export interface SugerenciaRequest {
  sugerencia: string;
}

export interface SugerenciaResponse {
  success: boolean;
  message: string;
  data?: {
    id: number;
    fecha: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class SugerenciasService {
  private baseApiUrl = environment.apiUrl + 'api/sugerencias';

  constructor(private http: HttpClient) {}
  enviarSugerencia(sugerencia: string): Observable<SugerenciaResponse> {
    const payload: SugerenciaRequest = { sugerencia: sugerencia.trim() };
    const url = `${this.baseApiUrl}/enviar`;

    return this.http
      .post<SugerenciaResponse>(url, payload)
      .pipe(catchError(this.handleError));
  }
  
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Unknown error';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage =
        error.error?.message || `Server error: ${error.status}`;
    }

    console.error('Error in SugerenciasService:', errorMessage);
    return throwError(() => errorMessage);
  }
}
