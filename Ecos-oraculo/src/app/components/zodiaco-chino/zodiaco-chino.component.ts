import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ZodiacoChinoService } from '../../services/zodiaco-chino.service';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PaypalService } from '../../services/paypal.service';

import { HttpClient } from '@angular/common/http';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';
import { environment } from '../../environments/environments.prod';

interface ChatMessage {
  role: 'user' | 'master';
  message: string;
  timestamp?: string;
  id?: string;
}

interface MasterInfo {
  success: boolean;
  master: {
    name: string;
    title: string;
    specialty: string;
    description: string;
    services: string[];
  };
  timestamp: string;
}

interface ZodiacAnimal {
  animal?: string;
  symbol?: string;
  year?: number;
  element?: string;
  traits?: string[];
}

@Component({
  selector: 'app-zodiaco-chino',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
  ],
  templateUrl: './zodiaco-chino.component.html',
  styleUrl: './zodiaco-chino.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZodiacoChinoComponent
  implements OnInit, AfterViewChecked, OnDestroy, AfterViewInit
{
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  // Main properties
  masterInfo: MasterInfo | null = null;
  userForm: FormGroup;
  isFormCompleted = false;
  isLoading = false;
  currentMessage = '';
  conversationHistory: ChatMessage[] = [];
  zodiacAnimal: ZodiacAnimal = {};
  showDataForm = true;
  isTyping: boolean = false;
  private shouldScrollToBottom = false;
  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // Variables for fortune control
  showFortuneWheel: boolean = false;
  horoscopePrizes: Prize[] = [
    {
      id: '1',
      name: '3 Zodiac Sign Wheel Spins',
      color: '#4ecdc4',
      icon: '🔮',
    },
    {
      id: '2',
      name: '1 Premium Zodiac Sign Analysis',
      color: '#45b7d1',
      icon: '✨',
    },
    {
      id: '4',
      name: 'Try again!',
      color: '#ff7675',
      icon: '🌙',
    },
  ];
  private wheelTimer: any;

  // Variables for payment control
  showPaymentModal: boolean = false;
  clientSecret: string | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForHoroscope: boolean = false;
  blockedMessageId: string | null = null;

  // ✅ NEW: 3 free messages system
  private userMessageCount: number = 0;
  private readonly FREE_MESSAGES_LIMIT = 3;

  // Data to send
  showDataModal: boolean = false;
  userData: any = null;
  private backendUrl = environment.apiUrl;

  constructor(
    private fb: FormBuilder,
    private zodiacoChinoService: ZodiacoChinoService,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private paypalService: PaypalService
  ) {
    // Form configuration for horoscope
    this.userForm = this.fb.group({
      fullName: [''],
      birthYear: [
        '',
        [Validators.required, Validators.min(1900), Validators.max(2024)],
      ],
      birthDate: [''],
      initialQuestion: [
        'What can you tell me about my zodiac sign and horoscope?',
      ],
    });
  }

  ngAfterViewInit(): void {
    this.setVideosSpeed(0.7);
  }

  private setVideosSpeed(rate: number): void {
    const host = this.elRef.nativeElement;
    const videos = host.querySelectorAll<HTMLVideoElement>('video');
    videos.forEach((v) => {
      const apply = () => (v.playbackRate = rate);
      if (v.readyState >= 1) apply();
      else v.addEventListener('loadedmetadata', apply, { once: true });
    });
  }

  async ngOnInit(): Promise<void> {
    // ✅ Check if we're coming from PayPal after a payment
    this.hasUserPaidForHoroscope =
      sessionStorage.getItem('hasUserPaidForHoroscope_horoskop') === 'true';

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          // ✅ Payment ONLY for this service (Horoscope)
          this.hasUserPaidForHoroscope = true;
          sessionStorage.setItem('hasUserPaidForHoroscope_horoskop', 'true');

          // DO NOT use global localStorage
          localStorage.removeItem('paypal_payment_completed');

          this.blockedMessageId = null;
          sessionStorage.removeItem('horoscopeBlockedMessageId');

          // Clear URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          // Close payment modal
          this.showPaymentModal = false;
          this.isProcessingPayment = false;
          this.paymentError = null;
          this.cdr.markForCheck();

          // ✅ CONFIRMATION MESSAGE
          setTimeout(() => {
            this.addMessage(
              'master',
              '🎉 Payment completed successfully!\n\n' +
                '✨ Thank you for your payment. You now have full access to the Chinese Horoscope.\n\n' +
                "🐉 Let's discover your astrological future together!\n\n" +
                '📌 Note: This payment is valid only for the Horoscope service. Other services require a separate payment.'
            );
            this.cdr.detectChanges();
            setTimeout(() => this.scrollToBottom(), 200);
          }, 1000);
        } else {
          this.paymentError = 'Could not verify the payment.';

          setTimeout(() => {
            this.addMessage(
              'master',
              '⚠️ There was a problem verifying your payment. Please try again or contact our support.'
            );
            this.cdr.detectChanges();
          }, 800);
        }
      } catch (error) {
        console.error('Error verifying PayPal payment:', error);
        this.paymentError = 'Error in payment verification';

        setTimeout(() => {
          this.addMessage(
            'master',
            '❌ Unfortunately, an error occurred while verifying your payment. Please try again later.'
          );
          this.cdr.detectChanges();
        }, 800);
      }
    }

    // ✅ NEW: Load message counter
    const savedMessageCount = sessionStorage.getItem('horoscopeUserMessageCount');
    if (savedMessageCount) {
      this.userMessageCount = parseInt(savedMessageCount, 10);
    }

    const savedUserData = sessionStorage.getItem('userData');
    if (savedUserData) {
      try {
        this.userData = JSON.parse(savedUserData);
      } catch (error) {
        this.userData = null;
      }
    } else {
      this.userData = null;
    }

    // Load saved horoscope-specific data
    this.loadHoroscopeData();

    this.loadMasterInfo();

    // Only add welcome message if no saved messages
    if (this.conversationHistory.length === 0) {
      this.initializeHoroscopeWelcomeMessage();
    }

    // ✅ ALSO CHECK FOR RESTORED MESSAGES
    if (
      this.conversationHistory.length > 0 &&
      FortuneWheelComponent.canShowWheel()
    ) {
      this.showHoroscopeWheelAfterDelay(2000);
    }
  }

  private loadHoroscopeData(): void {
    const savedMessages = sessionStorage.getItem('horoscopeMessages');
    const savedBlockedMessageId = sessionStorage.getItem(
      'horoscopeBlockedMessageId'
    );

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.conversationHistory = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp,
        }));
        this.blockedMessageId = savedBlockedMessageId || null;
      } catch (error) {
        this.clearHoroscopeSessionData();
        this.initializeHoroscopeWelcomeMessage();
      }
    }
  }

  private initializeHoroscopeWelcomeMessage(): void {
    const welcomeMessage = `Welcome to the Realm of the Stars! 🔮✨

I am Astrologer Maria, celestial guide of the zodiac signs. For decades I have studied the influences of the planets and constellations that guide our destiny.

Each person is born under the protection of a zodiac sign that influences their personality, their destiny, and their life path. To reveal the secrets of your horoscope and celestial influences, I need your birth date.

The twelve signs (Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, and Pisces) have ancestral wisdom to share.

Are you ready to discover what the stars reveal about your destiny? 🌙`;

    this.addMessage('master', welcomeMessage);

    // ✅ HOROSCOPE WHEEL VERIFICATION
    if (FortuneWheelComponent.canShowWheel()) {
      this.showHoroscopeWheelAfterDelay(3000);
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }

    if (
      this.shouldAutoScroll &&
      this.conversationHistory.length > this.lastMessageCount
    ) {
      this.scrollToBottom();
      this.lastMessageCount = this.conversationHistory.length;
    }
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }

  private saveHoroscopeMessagesToSession(): void {
    try {
      const messagesToSave = this.conversationHistory.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp,
      }));
      sessionStorage.setItem(
        'horoscopeMessages',
        JSON.stringify(messagesToSave)
      );
    } catch (error) {}
  }

  private clearHoroscopeSessionData(): void {
    sessionStorage.removeItem('hasUserPaidForHoroscope');
    sessionStorage.removeItem('horoscopeMessages');
    sessionStorage.removeItem('horoscopeBlockedMessageId');
    sessionStorage.removeItem('horoscopeUserMessageCount');
    sessionStorage.removeItem('freeHoroscopeConsultations');
    sessionStorage.removeItem('pendingHoroscopeMessage');
  }

  private saveHoroscopeStateBeforePayment(): void {
    this.saveHoroscopeMessagesToSession();
    sessionStorage.setItem(
      'horoscopeUserMessageCount',
      this.userMessageCount.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem(
        'horoscopeBlockedMessageId',
        this.blockedMessageId
      );
    }
  }

  isMessageBlocked(message: ChatMessage): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForHoroscope
    );
  }

  // ✅ METHOD MIGRATED TO PAYPAL
  async promptForHoroscopePayment(): Promise<void> {
    this.showPaymentModal = true;
    this.cdr.markForCheck();
    this.paymentError = null;
    this.isProcessingPayment = false;

    // Validate user data
    if (!this.userData) {
      const savedUserData = sessionStorage.getItem('userData');
      if (savedUserData) {
        try {
          this.userData = JSON.parse(savedUserData);
        } catch (error) {
          this.userData = null;
        }
      }
    }

    if (!this.userData) {
      this.paymentError =
        'Customer data not found. Please complete the form first.';
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

    const email = this.userData.email?.toString().trim();
    if (!email) {
      this.paymentError = 'Email required. Please complete the form.';
      this.showDataModal = true;
      this.cdr.markForCheck();
      return;
    }

    // Save pending message if exists
    if (this.currentMessage) {
      sessionStorage.setItem('pendingHoroscopeMessage', this.currentMessage);
    }
  }

  // ✅ METHOD MIGRATED TO PAYPAL
  async handleHoroscopePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;
    this.cdr.markForCheck();

    try {
      // Start PayPal payment flow (redirects user)
      await this.paypalService.initiatePayment({
        amount: '7.00',
        currency: 'USD',
        serviceName: 'Horoscope',
        returnPath: '/horoscope',
        cancelPath: '/horoscope',
      });

      // Code after this line will NOT execute because
      // user will be redirected to PayPal
    } catch (error: any) {
      this.paymentError =
        error.message || 'Error initiating PayPal payment.';
      this.isProcessingPayment = false;
      this.cdr.markForCheck();
    }
  }

  // ✅ SIMPLIFIED METHOD - PayPal doesn't require cleanup
  cancelHoroscopePayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
    this.cdr.markForCheck();
  }

  startChatWithoutForm(): void {
    this.showDataForm = false;
  }

  // Load master information
  loadMasterInfo(): void {
    this.zodiacoChinoService.getMasterInfo().subscribe({
      next: (info) => {
        this.masterInfo = info;
      },
      error: (error) => {
        // Default information in case of error
        this.masterInfo = {
          success: true,
          master: {
            name: 'Astrologer Maria',
            title: 'Celestial Guide of the Signs',
            specialty: 'Western Astrology and Personalized Horoscope',
            description:
              'Wise astrologer, specialized in the interpretation of celestial influences and the wisdom of the twelve zodiac signs',
            services: [
              'Zodiac sign interpretation',
              'Astral chart analysis',
              'Horoscope predictions',
              'Sign compatibility',
              'Astrology-based advice',
            ],
          },
          timestamp: new Date().toISOString(),
        };
      },
    });
  }

  // Start horoscope consultation
  startConsultation(): void {
    if (this.userForm.valid && !this.isLoading) {
      this.isLoading = true;
      this.cdr.markForCheck();

      const formData = this.userForm.value;

      const initialMessage =
        formData.initialQuestion ||
        "Hello! I'd like to know more about my zodiac sign and horoscope.";

      // Add user message
      this.addMessage('user', initialMessage);

      // Prepare data to send to backend
      const consultationData = {
        zodiacData: {
          name: 'Astrologer Maria',
          specialty: 'Western Astrology and Personalized Horoscope',
          experience: 'Decades of experience in astrological interpretation',
        },
        userMessage: initialMessage,
        fullName: formData.fullName,
        birthYear: formData.birthYear?.toString(),
        birthDate: formData.birthDate,
        conversationHistory: this.conversationHistory,
      };

      // ✅ Call service with message counter (initial message = 1)
      this.zodiacoChinoService
        .chatWithMasterWithCount(consultationData, 1, this.hasUserPaidForHoroscope)
        .subscribe({
          next: (response) => {
            this.isLoading = false;
            if (response.success && response.response) {
              this.addMessage('master', response.response);
              this.isFormCompleted = true;
              this.showDataForm = false;
              this.saveHoroscopeMessagesToSession();
              this.cdr.markForCheck();
            } else {
              this.handleError('Error in astrologer response');
            }
          },
          error: (error) => {
            this.isLoading = false;
            this.handleError(
              'Error connecting with the astrologer: ' +
                (error.error?.error || error.message)
            );
            this.cdr.markForCheck();
          },
        });
    }
  }

  // ✅ NEW: Get remaining free messages
  getFreeMessagesRemaining(): number {
    if (this.hasUserPaidForHoroscope) {
      return -1; // Unlimited
    }
    return Math.max(0, this.FREE_MESSAGES_LIMIT - this.userMessageCount);
  }

  sendMessage(): void {
    if (this.currentMessage.trim() && !this.isLoading) {
      const message = this.currentMessage.trim();

      // Calculate next message number
      const nextMessageCount = this.userMessageCount + 1;

      console.log(
        `📊 Horoscope - Message #${nextMessageCount}, Premium: ${this.hasUserPaidForHoroscope}, Limit: ${this.FREE_MESSAGES_LIMIT}`
      );

      // ✅ Check access
      const canSendMessage =
        this.hasUserPaidForHoroscope ||
        this.hasFreeHoroscopeConsultationsAvailable() ||
        nextMessageCount <= this.FREE_MESSAGES_LIMIT;

      if (!canSendMessage) {
        console.log('❌ No access - showing payment modal');

        // Close other modals
        this.showFortuneWheel = false;
        this.showPaymentModal = false;

        // Save pending message
        sessionStorage.setItem('pendingHoroscopeMessage', message);
        this.saveHoroscopeStateBeforePayment();

        // Show data modal
        setTimeout(() => {
          this.showDataModal = true;
          this.cdr.markForCheck();
        }, 100);

        return;
      }

      // ✅ If using free wheel consultation (after the 3 free ones)
      if (
        !this.hasUserPaidForHoroscope &&
        nextMessageCount > this.FREE_MESSAGES_LIMIT &&
        this.hasFreeHoroscopeConsultationsAvailable()
      ) {
        this.useFreeHoroscopeConsultation();
      }

      // Process message normally
      this.processHoroscopeUserMessage(message, nextMessageCount);
    }
  }

  private processHoroscopeUserMessage(message: string, messageCount: number): void {
    this.currentMessage = '';
    this.isLoading = true;
    this.isTyping = true;
    this.cdr.markForCheck();

    // Add user message
    this.addMessage('user', message);

    // ✅ Update counter
    this.userMessageCount = messageCount;
    sessionStorage.setItem(
      'horoscopeUserMessageCount',
      this.userMessageCount.toString()
    );

    const formData = this.userForm.value;
    const consultationData = {
      zodiacData: {
        name: 'Astrologer Maria',
        specialty: 'Western Astrology and Personalized Horoscope',
        experience: 'Decades of experience in astrological interpretation',
      },
      userMessage: message,
      fullName: formData.fullName,
      birthYear: formData.birthYear?.toString(),
      birthDate: formData.birthDate,
      conversationHistory: this.conversationHistory,
    };

    // ✅ Call service with message counter
    this.zodiacoChinoService
      .chatWithMasterWithCount(
        consultationData,
        messageCount,
        this.hasUserPaidForHoroscope
      )
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.isTyping = false;
          this.cdr.markForCheck();

          if (response.success && response.response) {
            const messageId = Date.now().toString();

            this.addMessage('master', response.response, messageId);

            // ✅ Show paywall if exceeded free limit AND has no wheel consultations
            const shouldShowPaywall =
              !this.hasUserPaidForHoroscope &&
              messageCount > this.FREE_MESSAGES_LIMIT &&
              !this.hasFreeHoroscopeConsultationsAvailable();

            if (shouldShowPaywall) {
              this.blockedMessageId = messageId;
              sessionStorage.setItem('horoscopeBlockedMessageId', messageId);

              setTimeout(() => {
                this.saveHoroscopeStateBeforePayment();

                // Close other modals
                this.showFortuneWheel = false;
                this.showPaymentModal = false;

                // Show data modal
                setTimeout(() => {
                  this.showDataModal = true;
                  this.cdr.markForCheck();
                }, 100);
              }, 2000);
            }

            this.saveHoroscopeMessagesToSession();
            this.cdr.markForCheck();
          } else {
            this.handleError('Error in astrologer response');
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.isTyping = false;
          this.handleError(
            'Error connecting with the astrologer: ' +
              (error.error?.error || error.message)
          );
          this.cdr.markForCheck();
        },
      });
  }

  // Handle Enter key
  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // Toggle form
  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  // Reset consultation
  resetConsultation(): void {
    this.conversationHistory = [];
    this.isFormCompleted = false;
    this.showDataForm = true;
    this.currentMessage = '';
    this.zodiacAnimal = {};
    this.blockedMessageId = null;

    // ✅ Reset counter
    if (!this.hasUserPaidForHoroscope) {
      this.userMessageCount = 0;
      this.clearHoroscopeSessionData();
    } else {
      sessionStorage.removeItem('horoscopeMessages');
      sessionStorage.removeItem('horoscopeBlockedMessageId');
      sessionStorage.removeItem('horoscopeUserMessageCount');
      this.userMessageCount = 0;
    }

    this.userForm.reset({
      fullName: '',
      birthYear: '',
      birthDate: '',
      initialQuestion:
        'What can you tell me about my zodiac sign and horoscope?',
    });
    this.initializeHoroscopeWelcomeMessage();
  }

  // Explore compatibility
  exploreCompatibility(): void {
    const message =
      'Could you talk about the compatibility of my zodiac sign with other signs?';
    this.currentMessage = message;
    this.sendMessage();
  }

  // Explore elements
  exploreElements(): void {
    const message = 'How do the planets influence my personality and destiny?';
    this.currentMessage = message;
    this.sendMessage();
  }

  // Auxiliary methods
  private addMessage(
    role: 'user' | 'master',
    message: string,
    id?: string
  ): void {
    const newMessage: ChatMessage = {
      role,
      message,
      timestamp: new Date().toISOString(),
      id: id || undefined,
    };
    this.conversationHistory.push(newMessage);
    this.shouldScrollToBottom = true;
    this.saveHoroscopeMessagesToSession();
    this.cdr.markForCheck();
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      try {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      } catch (err) {}
    }
  }

  private handleError(message: string): void {
    this.addMessage(
      'master',
      `Sorry, ${message}. Please try again.`
    );
  }

  formatMessage(content: string): string {
    if (!content) return '';

    let formattedContent = content;

    // Convert **text** to <strong>text</strong> for bold
    formattedContent = formattedContent.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );

    // Convert line breaks to <br> for better display
    formattedContent = formattedContent.replace(/\n/g, '<br>');

    // Optional: Also handle *text* (single asterisk) as italic
    formattedContent = formattedContent.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    return formattedContent;
  }

  formatTime(timestamp?: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackByMessage(index: number, message: ChatMessage): string {
    return `${message.role}-${message.timestamp}-${index}`;
  }

  // Auto-resize textarea
  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  // Handle Enter key
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // Clear chat
  clearChat(): void {
    this.conversationHistory = [];
    this.currentMessage = '';
    this.blockedMessageId = null;
    this.isLoading = false;

    // ✅ Reset counter
    if (!this.hasUserPaidForHoroscope) {
      this.userMessageCount = 0;
      sessionStorage.removeItem('horoscopeMessages');
      sessionStorage.removeItem('horoscopeBlockedMessageId');
      sessionStorage.removeItem('horoscopeUserMessageCount');
      sessionStorage.removeItem('freeHoroscopeConsultations');
      sessionStorage.removeItem('pendingHoroscopeMessage');
    } else {
      sessionStorage.removeItem('horoscopeMessages');
      sessionStorage.removeItem('horoscopeBlockedMessageId');
      sessionStorage.removeItem('horoscopeUserMessageCount');
      this.userMessageCount = 0;
    }

    this.shouldScrollToBottom = true;
    this.initializeHoroscopeWelcomeMessage();
  }

  resetChat(): void {
    // 1. Reset arrays and messages
    this.conversationHistory = [];
    this.currentMessage = '';

    // 2. Reset loading and typing states
    this.isLoading = false;
    this.isTyping = false;

    // 3. Reset form states
    this.isFormCompleted = false;
    this.showDataForm = true;

    // 4. Reset payment and blocking states
    this.blockedMessageId = null;

    // 5. Reset modals
    this.showPaymentModal = false;
    this.showDataModal = false;
    this.showFortuneWheel = false;

    // 6. Reset scroll variables and counters
    this.shouldScrollToBottom = false;
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    // 7. Reset zodiac animal
    this.zodiacAnimal = {};

    // 8. ✅ PayPal doesn't require element cleanup
    this.isProcessingPayment = false;
    this.paymentError = null;

    // 9. Clear timers
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    // 10. ✅ Reset counter and clear sessionStorage
    if (!this.hasUserPaidForHoroscope) {
      this.userMessageCount = 0;
      sessionStorage.removeItem('horoscopeMessages');
      sessionStorage.removeItem('horoscopeBlockedMessageId');
      sessionStorage.removeItem('horoscopeUserMessageCount');
      sessionStorage.removeItem('freeHoroscopeConsultations');
      sessionStorage.removeItem('pendingHoroscopeMessage');
    } else {
      sessionStorage.removeItem('horoscopeMessages');
      sessionStorage.removeItem('horoscopeBlockedMessageId');
      sessionStorage.removeItem('horoscopeUserMessageCount');
      this.userMessageCount = 0;
    }
    // DO NOT clear 'userData' or 'hasUserPaidForHoroscope'

    // 11. Reset form
    this.userForm.reset({
      fullName: '',
      birthYear: '',
      birthDate: '',
      initialQuestion:
        'What can you tell me about my zodiac sign and horoscope?',
    });

    // 12. Reinitialize welcome message
    this.initializeHoroscopeWelcomeMessage();
    this.cdr.markForCheck();
  }

  onUserDataSubmitted(userData: any): void {
    // ✅ VALIDATE CRITICAL FIELDS BEFORE PROCEEDING
    const requiredFields = ['email'];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      alert(
        `To continue, you must complete the following: ${missingFields.join(
          ', '
        )}`
      );
      this.showDataModal = true; // Keep modal open
      this.cdr.markForCheck();
      return;
    }

    // ✅ CLEAN AND SAVE data IMMEDIATELY in memory AND sessionStorage
    this.userData = {
      ...userData,
      email: userData.email?.toString().trim(),
    };

    // ✅ SAVE IN sessionStorage IMMEDIATELY
    try {
      sessionStorage.setItem('userData', JSON.stringify(this.userData));

      // Verify that it was saved correctly
      const verification = sessionStorage.getItem('userData');
    } catch (error) {}

    this.showDataModal = false;
    this.cdr.markForCheck();

    // ✅ NEW: Send data to backend as in other components
    this.sendUserDataToBackend(userData);
  }

  private sendUserDataToBackend(userData: any): void {
    this.http.post(`${this.backendUrl}api/recolecta`, userData).subscribe({
      next: (response) => {
        this.promptForHoroscopePayment();
      },
      error: (error) => {
        this.promptForHoroscopePayment();
      },
    });
  }

  onDataModalClosed(): void {
    this.showDataModal = false;
    this.cdr.markForCheck();
  }

  showHoroscopeWheelAfterDelay(delayMs: number = 3000): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    this.wheelTimer = setTimeout(() => {
      if (
        FortuneWheelComponent.canShowWheel() &&
        !this.showPaymentModal &&
        !this.showDataModal
      ) {
        this.showFortuneWheel = true;
        this.cdr.markForCheck();
      }
    }, delayMs);
  }

  onPrizeWon(prize: Prize): void {
    const prizeMessage: ChatMessage = {
      role: 'master',
      message: `🔮 The stars have conspired in your favor! You have won: **${prize.name}** ${prize.icon}\n\nThe celestial forces have decided to bless you with this sacred gift. The energy of the zodiac sign flows through you, revealing deeper secrets of your personal horoscope. May astrological wisdom illuminate you!`,
      timestamp: new Date().toISOString(),
    };

    this.conversationHistory.push(prizeMessage);
    this.shouldScrollToBottom = true;
    this.saveHoroscopeMessagesToSession();

    this.processHoroscopePrize(prize);
  }

  onWheelClosed(): void {
    this.showFortuneWheel = false;
  }

  triggerHoroscopeWheel(): void {
    if (this.showPaymentModal || this.showDataModal) {
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.showFortuneWheel = true;
      this.cdr.markForCheck();
    } else {
      alert(
        "You don't have more spins available. " +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }

  private processHoroscopePrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Horoscope Readings
        this.addFreeHoroscopeConsultations(3);
        break;
      case '2': // 1 Premium Analysis - FULL ACCESS
        this.hasUserPaidForHoroscope = true;
        sessionStorage.setItem('hasUserPaidForHoroscope', 'true');

        // Unlock any blocked message
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('horoscopeBlockedMessageId');
        }

        // Add special message for this prize
        const premiumMessage: ChatMessage = {
          role: 'master',
          message:
            '🌟 **You have unlocked full premium access!** 🌟\n\nThe stars have smiled exceptionally upon you. You now have unlimited access to all my astrological wisdom. You can consult your horoscope, compatibility, predictions, and all celestial secrets as many times as you wish.\n\n✨ *The universe has opened all doors for you* ✨',
          timestamp: new Date().toISOString(),
        };
        this.conversationHistory.push(premiumMessage);
        this.shouldScrollToBottom = true;
        this.saveHoroscopeMessagesToSession();
        break;
      case '4': // Another chance
        break;
      default:
    }
  }

  private addFreeHoroscopeConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeHoroscopeConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeHoroscopeConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForHoroscope) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('horoscopeBlockedMessageId');
    }
  }

  private hasFreeHoroscopeConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeHoroscopeConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeHoroscopeConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeHoroscopeConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem(
        'freeHoroscopeConsultations',
        remaining.toString()
      );

      const prizeMsg: ChatMessage = {
        role: 'master',
        message: `✨ *You have used a free astrological reading* ✨\n\nYou have **${remaining}** astrological consultations remaining.`,
        timestamp: new Date().toISOString(),
      };
      this.conversationHistory.push(prizeMsg);
      this.shouldScrollToBottom = true;
      this.saveHoroscopeMessagesToSession();
    }
  }

  debugHoroscopeWheel(): void {
    this.showFortuneWheel = true;
    this.cdr.markForCheck();
  }

  // ✅ HELPER METHOD for the template
  getHoroscopeConsultationsCount(): number {
    return parseInt(
      sessionStorage.getItem('freeHoroscopeConsultations') || '0'
    );
  }
}