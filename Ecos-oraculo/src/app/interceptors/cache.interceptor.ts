import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of, tap } from 'rxjs';
import { LoggerService } from '../services/logger.service';

/**
 * Caché simple en memoria para respuestas HTTP
 */
class HttpCache {
  private cache = new Map<string, { response: HttpResponse<any>; timestamp: number }>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutos

  get(url: string): HttpResponse<any> | null {
    const cached = this.cache.get(url);
    
    if (!cached) {
      return null;
    }

    // Check if cache expired
    const age = Date.now() - cached.timestamp;
    if (age > this.defaultTTL) {
      this.cache.delete(url);
      return null;
    }

    return cached.response.clone();
  }

  put(url: string, response: HttpResponse<any>): void {
    this.cache.set(url, {
      response: response.clone(),
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  delete(url: string): void {
    this.cache.delete(url);
  }
}

// Singleton cache instance
const cache = new HttpCache();

/**
 * Interceptor HTTP para cachear respuestas GET
 * Mejora el rendimiento evitando llamadas repetidas al servidor
 */
export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);

  // Only cache GET requests
  if (req.method !== 'GET') {
    return next(req);
  }

  // Don't cache requests with specific headers
  if (req.headers.has('X-No-Cache')) {
    return next(req);
  }

  // Check cache
  const cachedResponse = cache.get(req.urlWithParams);
  
  if (cachedResponse) {
    logger.debug(`Cache HIT: ${req.urlWithParams}`);
    return of(cachedResponse);
  }

  logger.debug(`Cache MISS: ${req.urlWithParams}`);

  // If not cached, make request and cache response
  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        cache.put(req.urlWithParams, event);
        logger.debug(`Cached response: ${req.urlWithParams}`);
      }
    })
  );
};

/**
 * Helper function to clear the cache
 */
export function clearHttpCache(): void {
  cache.clear();
}

/**
 * Helper function to clear specific URL from cache
 */
export function clearCacheForUrl(url: string): void {
  cache.delete(url);
}
