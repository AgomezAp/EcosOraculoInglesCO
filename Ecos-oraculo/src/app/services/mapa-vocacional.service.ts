import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, timeout } from 'rxjs';
import { environment } from '../environments/environments';
// ✅ Interface for vocational counselor data
interface VocationalData {
  name: string;
  title?: string;
  specialty: string;
  experience: string;
}

// ✅ Request Interface - EXPORTED
export interface VocationalRequest {
  vocationalData: VocationalData;
  userMessage: string;
  personalInfo?: any;
  assessmentAnswers?: any[];
  conversationHistory?: Array<{
    role: 'user' | 'counselor';
    message: string;
  }>;
  // ✅ NEW FIELDS for the 3 free messages system
  messageCount?: number;
  isPremiumUser?: boolean;
}

// ✅ Response Interface - EXPORTED
export interface VocationalResponse {
  success: boolean;
  response?: string;
  error?: string;
  code?: string;
  timestamp?: string;
  // ✅ NEW FIELDS returned by the backend
  freeMessagesRemaining?: number;
  showPaywall?: boolean;
  paywallMessage?: string;
  isCompleteResponse?: boolean;
}

// ✅ Interface for counselor information - EXPORTED
export interface CounselorInfo {
  success: boolean;
  counselor: {
    name: string;
    title: string;
    specialty: string;
    description: string;
    services: string[];
  };
  freeMessagesLimit?: number;
  timestamp: string;
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

interface AssessmentAnswer {
  question: string;
  answer: string;
  category: string;
}

interface VocationalProfile {
  name: string;
  description: string;
  characteristics: string[];
  workEnvironments: string[];
}

@Injectable({
  providedIn: 'root',
})
export class MapaVocacionalService {
  private appUrl: string;
  private apiUrl: string;

  // Default vocational counselor data
  private defaultVocationalData: VocationalData = {
    name: 'Dr. Valeria',
    title: 'Professional Guidance Specialist',
    specialty: 'Professional guidance and personalized career charts',
    experience:
      'Years of experience in vocational guidance and career development',
  };

  // Vocational profiles
  private vocationalProfiles: { [key: string]: VocationalProfile } = {
    realistic: {
      name: 'Realistic',
      description:
        'Prefers practical activities and working with tools, machines, or animals.',
      characteristics: ['Practical', 'Mechanical', 'Athletic', 'Frank'],
      workEnvironments: [
        'Outdoors',
        'Workshops',
        'Laboratories',
        'Construction',
      ],
    },
    investigative: {
      name: 'Investigative',
      description:
        'Enjoys solving complex problems and conducting research.',
      characteristics: ['Analytical', 'Curious', 'Independent', 'Reserved'],
      workEnvironments: [
        'Laboratories',
        'Universities',
        'Research centers',
      ],
    },
    artistic: {
      name: 'Artistic',
      description:
        'Values self-expression, creativity, and unstructured work.',
      characteristics: ['Creative', 'Original', 'Independent', 'Expressive'],
      workEnvironments: ['Studios', 'Theaters', 'Creative agencies', 'Museums'],
    },
    social: {
      name: 'Social',
      description: 'Prefers working with people, helping and teaching.',
      characteristics: ['Cooperative', 'Empathetic', 'Patient', 'Generous'],
      workEnvironments: [
        'Schools',
        'Hospitals',
        'NGOs',
        'Social services',
      ],
    },
    enterprising: {
      name: 'Enterprising',
      description:
        'Likes to lead, persuade, and make business decisions.',
      characteristics: ['Ambitious', 'Energetic', 'Dominant', 'Optimistic'],
      workEnvironments: ['Companies', 'Sales', 'Politics', 'Startups'],
    },
    conventional: {
      name: 'Conventional',
      description:
        'Prefers orderly activities, following established procedures.',
      characteristics: ['Organized', 'Precise', 'Efficient', 'Practical'],
      workEnvironments: [
        'Offices',
        'Banks',
        'Accounting',
        'Administration',
      ],
    },
  };

  constructor(private http: HttpClient) {
    this.appUrl = environment.apiUrl;
    this.apiUrl = 'api/vocational';
  }

  /**
   * ✅ MAIN METHOD: Send message with message counter
   */
  sendMessageWithCount(
    userMessage: string,
    messageCount: number,
    isPremiumUser: boolean,
    personalInfo?: any,
    assessmentAnswers?: any[],
    conversationHistory?: Array<{ role: 'user' | 'counselor'; message: string }>
  ): Observable<VocationalResponse> {
    const request: VocationalRequest = {
      vocationalData: this.defaultVocationalData,
      userMessage: userMessage.trim(),
      personalInfo,
      assessmentAnswers,
      conversationHistory,
      messageCount,
      isPremiumUser,
    };

    console.log('📤 Sending vocational message:', {
      messageCount: request.messageCount,
      isPremiumUser: request.isPremiumUser,
      userMessage: request.userMessage.substring(0, 50) + '...',
    });

    return this.http
      .post<VocationalResponse>(`${this.appUrl}${this.apiUrl}/counselor`, request)
      .pipe(
        timeout(60000),
        map((response: VocationalResponse) => {
          console.log('📥 Vocational response:', {
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
          console.error('Error in vocational communication:', error);
          return of({
            success: false,
            error: this.getErrorMessage(error),
            timestamp: new Date().toISOString(),
          } as VocationalResponse);
        })
      );
  }

  /**
   * Legacy method for compatibility
   */
  sendMessage(
    userMessage: string,
    personalInfo?: any,
    assessmentAnswers?: any[],
    conversationHistory?: Array<{ role: 'user' | 'counselor'; message: string }>
  ): Observable<string> {
    const request: VocationalRequest = {
      vocationalData: this.defaultVocationalData,
      userMessage: userMessage.trim(),
      personalInfo,
      assessmentAnswers,
      conversationHistory,
      messageCount: 1,
      isPremiumUser: false,
    };

    return this.http
      .post<VocationalResponse>(`${this.appUrl}${this.apiUrl}/counselor`, request)
      .pipe(
        timeout(30000),
        map((response: VocationalResponse) => {
          if (response.success && response.response) {
            return response.response;
          }
          throw new Error(response.error || 'Invalid server response');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Error in vocational communication:', error);
          return of(this.getErrorMessage(error));
        })
      );
  }

  /**
   * Get assessment questions
   */
  getAssessmentQuestions(): Observable<AssessmentQuestion[]> {
    return of(this.getDefaultQuestions());
  }

  /**
   * Analyze assessment answers
   */
  analyzeAssessment(answers: AssessmentAnswer[]): Observable<any> {
    const categoryCount: { [key: string]: number } = {};

    answers.forEach((answer) => {
      if (answer.category) {
        categoryCount[answer.category] =
          (categoryCount[answer.category] || 0) + 1;
      }
    });

    const total = answers.length;
    const distribution = Object.entries(categoryCount)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const dominantCategory = distribution[0]?.category || 'social';
    const dominantProfile =
      this.vocationalProfiles[dominantCategory] ||
      this.vocationalProfiles['social'];

    return of({
      profileDistribution: distribution,
      dominantProfile,
      recommendations: this.getRecommendations(dominantCategory),
    });
  }

  /**
   * Get category emoji
   */
  getCategoryEmoji(category: string): string {
    const emojis: { [key: string]: string } = {
      realistic: '🔧',
      investigative: '🔬',
      artistic: '🎨',
      social: '🤝',
      enterprising: '💼',
      conventional: '📊',
    };
    return emojis[category] || '⭐';
  }

  /**
   * Get category color
   */
  getCategoryColor(category: string): string {
    const colors: { [key: string]: string } = {
      realistic: '#4CAF50',
      investigative: '#2196F3',
      artistic: '#9C27B0',
      social: '#FF9800',
      enterprising: '#F44336',
      conventional: '#607D8B',
    };
    return colors[category] || '#757575';
  }

  /**
   * Get default questions
   */
  private getDefaultQuestions(): AssessmentQuestion[] {
    return [
      {
        id: 1,
        question:
          'What type of activity do you prefer to do in your free time?',
        options: [
          {
            value: 'a',
            label: 'Build or repair things',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'Read and research new topics',
            category: 'investigative',
          },
          { value: 'c', label: 'Create art or music', category: 'artistic' },
          { value: 'd', label: 'Help other people', category: 'social' },
          {
            value: 'e',
            label: 'Organize events or lead groups',
            category: 'enterprising',
          },
          {
            value: 'f',
            label: 'Organize and classify information',
            category: 'conventional',
          },
        ],
      },
      {
        id: 2,
        question:
          'In what type of work environment would you feel most comfortable?',
        options: [
          {
            value: 'a',
            label: 'Outdoors or in a workshop',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'In a laboratory or research center',
            category: 'investigative',
          },
          { value: 'c', label: 'In a creative studio', category: 'artistic' },
          {
            value: 'd',
            label: 'In a school or hospital',
            category: 'social',
          },
          {
            value: 'e',
            label: 'In a company or startup',
            category: 'enterprising',
          },
          {
            value: 'f',
            label: 'In a well-organized office',
            category: 'conventional',
          },
        ],
      },
      {
        id: 3,
        question: 'Which of these skills best describes you?',
        options: [
          {
            value: 'a',
            label: 'Manual and technical skills',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'Analytical thinking',
            category: 'investigative',
          },
          {
            value: 'c',
            label: 'Creativity and imagination',
            category: 'artistic',
          },
          { value: 'd', label: 'Empathy and communication', category: 'social' },
          {
            value: 'e',
            label: 'Leadership and persuasion',
            category: 'enterprising',
          },
          {
            value: 'f',
            label: 'Organization and precision',
            category: 'conventional',
          },
        ],
      },
      {
        id: 4,
        question: 'What type of problem would you prefer to solve?',
        options: [
          {
            value: 'a',
            label: 'Repair a broken machine',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'Discover why something works a certain way',
            category: 'investigative',
          },
          {
            value: 'c',
            label: 'Design something new and original',
            category: 'artistic',
          },
          {
            value: 'd',
            label: 'Help someone with a personal problem',
            category: 'social',
          },
          {
            value: 'e',
            label: 'Find a business opportunity',
            category: 'enterprising',
          },
          {
            value: 'f',
            label: 'Optimize an existing process',
            category: 'conventional',
          },
        ],
      },
      {
        id: 5,
        question: 'What subject did you like most in school?',
        options: [
          {
            value: 'a',
            label: 'Physical education or technology',
            category: 'realistic',
          },
          {
            value: 'b',
            label: 'Science or mathematics',
            category: 'investigative',
          },
          { value: 'c', label: 'Art or music', category: 'artistic' },
          {
            value: 'd',
            label: 'Social sciences or languages',
            category: 'social',
          },
          { value: 'e', label: 'Economics or debate', category: 'enterprising' },
          {
            value: 'f',
            label: 'Computer science or accounting',
            category: 'conventional',
          },
        ],
      },
    ];
  }

  /**
   * Get recommendations by category
   */
  private getRecommendations(category: string): string[] {
    const recommendations: { [key: string]: string[] } = {
      realistic: [
        'Mechanical or civil engineering',
        'Maintenance technician',
        'Carpentry or electrician',
        'Agriculture or veterinary',
      ],
      investigative: [
        'Natural sciences or medicine',
        'Scientific research',
        'Data analysis',
        'Programming and software development',
      ],
      artistic: [
        'Graphic or industrial design',
        'Fine arts or music',
        'Architecture',
        'Audiovisual production',
      ],
      social: [
        'Psychology or social work',
        'Education or pedagogy',
        'Nursing or medicine',
        'Human resources',
      ],
      enterprising: [
        'Business administration',
        'Marketing and sales',
        'Law',
        'Entrepreneurship',
      ],
      conventional: [
        'Accounting and finance',
        'Public administration',
        'Executive secretary',
        'Logistics and operations',
      ],
    };
    return recommendations[category] || recommendations['social'];
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
      return 'Cannot connect to the vocational counselor. Please try again in a few minutes.';
    }

    return 'Sorry, I am experiencing technical difficulties. Please try again later.';
  }
}