import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
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
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environments';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';
import { LoggerService } from '../../services/logger.service';
import { StorageService } from '../../services/storage.service';
import { PaypalService } from '../../services/paypal.service';
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
    FortuneWheelComponent,
  ],
  templateUrl: './zodiaco-chino.component.html',
  styleUrl: './zodiaco-chino.component.css',
})
export class ZodiacoChinoComponent
  implements OnInit, AfterViewChecked, OnDestroy, AfterViewInit
{
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  // Propiedades principales
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
  //Variables para control de fortuna
  showFortuneWheel: boolean = false;
  horoscopePrizes: Prize[] = [
    {
      id: '1',
      name: '3 spins extra',
      color: '#4ecdc4',
      icon: '🔮',
    },
    {
      id: '2',
      name: '1 Premium zodiac analysis',
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
  // PayPal payment control
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForHoroscope: boolean = false;
  firstQuestionAsked: boolean = false;
  blockedMessageId: string | null = null;
  //Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;
  private backendUrl = environment.apiUrl;

  constructor(
    private fb: FormBuilder,
    private zodiacoChinoService: ZodiacoChinoService,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>,
    private logger: LoggerService,
    private storage: StorageService,
    private paypalService: PaypalService
  ) {
    // Configuración del formulario para horóscopo
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
    this.setVideosSpeed(0.7); // 0.5 = más lento, 1 = normal
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
    this.hasUserPaidForHoroscope =
      this.storage.hasUserPaid('Horoscope');

    // ✅ NUEVO: Cargar datos del usuario desde sessionStorage
    this.logger.log(
      '🔍 Cargando datos del usuario desde sessionStorage para horóscopo...'
    );
    const savedUserData = JSON.stringify(this.storage.getUserData());
    if (savedUserData) {
      try {
        this.userData = JSON.parse(savedUserData);
        this.logger.log(
          '✅ Datos del usuario restaurados para horóscopo:',
          this.userData
        );
      } catch (error) {
        this.logger.error('❌ Error al parsear datos del usuario:', error);
        this.userData = null;
      }
    } else {
      this.logger.log(
        'ℹ️ No hay datos del usuario guardados en sessionStorage para horóscopo'
      );
      this.userData = null;
    }

    // Cargar datos guardados específicos del horóscopo
    this.loadHoroscopeData();

    // Verificar URL para pagos exitosos
    this.checkHoroscopePaymentStatus();

    this.loadMasterInfo();

    // Solo agregar mensaje de bienvenida si no hay mensajes guardados
    if (this.conversationHistory.length === 0) {
      this.initializeHoroscopeWelcomeMessage();
    }

    // ✅ TAMBIÉN VERIFICAR PARA MENSAJES RESTAURADOS
    if (
      this.conversationHistory.length > 0 &&
      FortuneWheelComponent.canShowWheel()
    ) {
      this.showHoroscopeWheelAfterDelay(2000);
    }
  }
  private loadHoroscopeData(): void {
    const savedMessages = JSON.stringify(this.storage.getMessages('horoscopeMessages'));
    const savedFirstQuestion = this.storage.isFirstQuestion('horoscope') ? null : 'true';
    const savedBlockedMessageId = this.storage.getBlockedMessageId('horoscope');

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.conversationHistory = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp,
        }));
        this.firstQuestionAsked = savedFirstQuestion === 'true';
        this.blockedMessageId = savedBlockedMessageId || null;
        this.logger.log(
          '✅ Mensajes del horóscopo restaurados desde sessionStorage'
        );
      } catch (error) {
        this.logger.error('Error al restaurar mensajes del horóscopo:', error);
        this.clearHoroscopeSessionData();
        this.initializeHoroscopeWelcomeMessage();
      }
    }
  }
  private initializeHoroscopeWelcomeMessage(): void {
    const welcomeMessage = `Greetings and welcome to the realm of the stars! 🔮✨

I am High Priestess María, celestial guide of the zodiac signs. For decades, I have studied the influences of the planets and the constellations that guide our destiny.

Each person is born under the protection of a zodiac sign that influences their personality, destiny, and path in life. To reveal the secrets of your horoscope and the celestial influences, I need to know your date of birth.

The twelve signs (Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, and Pisces) have ancestral wisdom to share with you.

Are you ready to discover what the stars reveal about your destiny? 🌙`;

    this.addMessage('master', welcomeMessage);

    // ✅ VERIFICACIÓN DE RULETA HOROSCÓPICA
    if (FortuneWheelComponent.canShowWheel()) {
      this.showHoroscopeWheelAfterDelay(3000);
    } else {
      this.logger.log(
        '🚫 No se puede mostrar ruleta horoscópica - sin tiradas disponibles'
      );
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

  private async checkHoroscopePaymentStatus(): Promise<void> {
    this.hasUserPaidForHoroscope = this.storage.hasUserPaid('Horoscope');

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          this.hasUserPaidForHoroscope = true;
          this.storage.setUserPaid('Horoscope', true);

          this.blockedMessageId = null;
          this.storage.removeBlockedMessageId('horoscope');

          window.history.replaceState({}, document.title, window.location.pathname);

          this.showPaymentModal = false;
          this.isProcessingPayment = false;
          this.paymentError = null;

          setTimeout(() => {
            this.addMessage(
              'master',
              '🎉 Payment completed successfully!\n\n' +
              '✨ Thank you. You now have full access to Chinese Horoscope.\n\n' +
              '🔮 Let\'s explore the wisdom of the stars together!'
            );
            this.saveHoroscopeMessagesToSession();

            const pendingMessage = this.storage.getSessionItem<string>('pendingHoroscopeMessage');
            if (pendingMessage) {
              this.storage.removeSessionItem('pendingHoroscopeMessage');
              setTimeout(() => {
                this.processHoroscopeUserMessage(pendingMessage);
              }, 1000);
            }
          }, 1000);
        } else {
          this.paymentError = 'Payment could not be verified.';
        }
      } catch (error) {
        this.logger.error('Error verificando pago de PayPal:', error);
        this.paymentError = 'Error in payment verification';
      }
    }
  }

  private saveHoroscopeMessagesToSession(): void {
    try {
      const messagesToSave = this.conversationHistory.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp,
      }));
      this.storage.setMessages('horoscopeMessages', messagesToSave);
    } catch (error) {
      this.logger.error('Error guardando mensajes del horóscopo:', error);
    }
  }

  private clearHoroscopeSessionData(): void {
    this.storage.removeSessionItem('hasUserPaidForHoroscope');
    this.storage.removeSessionItem('horoscopeMessages');
    this.storage.removeSessionItem('horoscopeFirstQuestionAsked');
    this.storage.removeBlockedMessageId('horoscope');
  }

  private saveHoroscopeStateBeforePayment(): void {
    this.logger.log('💾 Guardando estado del horóscopo antes del pago...');
    this.saveHoroscopeMessagesToSession();
    this.storage.markFirstQuestionAsked('horoscope');
    if (this.blockedMessageId) {
      this.storage.setBlockedMessageId('horoscope', this.blockedMessageId);
    }
  }

  isMessageBlocked(message: ChatMessage): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForHoroscope
    );
  }

  async promptForHoroscopePayment(): Promise<void> {
    this.showPaymentModal = true;
    this.paymentError = null;
    this.isProcessingPayment = false;

    if (!this.userData) {
      const savedUserData = JSON.stringify(this.storage.getUserData());
      if (savedUserData) {
        try {
          this.userData = JSON.parse(savedUserData);
        } catch (error) {
          this.userData = null;
        }
      }
    }

    if (!this.userData) {
      this.paymentError = 'No user data found. Please complete the form first.';
      this.showDataModal = true;
      return;
    }

    const email = this.userData.email?.toString().trim();
    if (!email) {
      this.paymentError = 'Email required. Please complete the form.';
      this.showDataModal = true;
      return;
    }

    if (this.currentMessage) {
      this.storage.setSessionItem('pendingHoroscopeMessage', this.currentMessage);
    }
  }

  async handleHoroscopePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;

    try {
      const orderData = {
        amount: '7.00',
        currency: 'USD',
        serviceName: 'Chinese Horoscope Reading',
        returnPath: '/chinese-zodiac',
        cancelPath: '/chinese-zodiac',
      };

      await this.paypalService.initiatePayment(orderData);
    } catch (error: any) {
      this.paymentError = error.message || 'Error initializing PayPal payment.';
      this.isProcessingPayment = false;
    }
  }

  cancelHoroscopePayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
  }

  startChatWithoutForm(): void {
    this.showDataForm = false;
  }

  // Cargar información del maestro
  loadMasterInfo(): void {
    this.zodiacoChinoService.getMasterInfo().subscribe({
      next: (info) => {
        this.masterInfo = info;
      },
      error: (error) => {
        this.logger.error('Error cargando información del maestro:', error);
        // Información predeterminada en caso de error
        this.masterInfo = {
          success: true,
          master: {
            name: 'High Priestess María',
            title: 'Celestial Guide of Signs',
            specialty: 'Western Astrology and Personalized Horoscope',
            description:
              'Wise High Priestess specialized in interpreting celestial influences and the wisdom of the twelve zodiac signs',
            services: [
              'Interpretation of zodiac signs',
              'Analysis of birth charts',
              'Horoscope predictions',
              'Compatibility between signs',
              'Astrology-based advice',
            ],
          },
          timestamp: new Date().toISOString(),
        };
      },
    });
  }

  // Iniciar consulta del horóscopo
  startConsultation(): void {
    if (this.userForm.valid && !this.isLoading) {
      this.isLoading = true;

      const formData = this.userForm.value;

      // Calcular animal del zodiaco

      const initialMessage =
        formData.initialQuestion ||
        'Hello! I would like to know more about my zodiac sign and horoscope.';

      // Agregar mensaje del usuario
      this.addMessage('user', initialMessage);

      // Marcar que se hizo la primera pregunta
      if (!this.firstQuestionAsked) {
        this.firstQuestionAsked = true;
        this.storage.markFirstQuestionAsked('horoscope');
      }

      // Preparar datos para enviar al backend
      const consultationData = {
        zodiacData: {
          name: 'High Priestess María',
          specialty: 'Western Astrology and Personalized Horoscope',
          experience: 'Decades of experience in astrological interpretation',
        },
        userMessage: initialMessage,
        fullName: formData.fullName,
        birthYear: formData.birthYear?.toString(),
        birthDate: formData.birthDate,
        conversationHistory: this.conversationHistory,
      };

      // Llamar al servicio
      this.zodiacoChinoService.chatWithMaster(consultationData).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success && response.response) {
            this.addMessage('master', response.response);
            this.isFormCompleted = true;
            this.showDataForm = false;
            this.saveHoroscopeMessagesToSession();
          } else {
            this.handleError('Error en la respuesta de la astróloga');
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.handleError(
            'Error connecting with the astrologer: ' +
              (error.error?.error || error.message)
          );
        },
      });
    }
  }

  sendMessage(): void {
    if (this.currentMessage.trim() && !this.isLoading) {
      const message = this.currentMessage.trim();

      // ✅ LÓGICA ACTUALIZADA: Verificar acceso premium O consultas gratuitas
      if (!this.hasUserPaidForHoroscope && this.firstQuestionAsked) {
        // Verificar si tiene consultas horoscópicas gratis disponibles
        if (this.hasFreeHoroscopeConsultationsAvailable()) {
          this.logger.log('🎁 Usando consulta horoscópica gratis del premio');
          this.useFreeHoroscopeConsultation();
          // Continuar con el mensaje sin bloquear
        } else {
          // Si no tiene consultas gratis NI acceso premium, mostrar modal de datos
          this.logger.log(
            '💳 No hay consultas horoscópicas gratis ni acceso premium - mostrando modal de datos'
          );

          // Cerrar otros modales primero
          this.showFortuneWheel = false;
          this.showPaymentModal = false;

          // Guardar el mensaje para procesarlo después del pago
          this.storage.setSessionItem('pendingHoroscopeMessage', message);

          this.saveHoroscopeStateBeforePayment();

          // Mostrar modal de datos con timeout
          setTimeout(() => {
            this.showDataModal = true;
            this.logger.log('📝 showDataModal establecido a:', this.showDataModal);
          }, 100);

          return; // Salir aquí para no procesar el mensaje aún
        }
      }

      // Procesar mensaje normalmente
      this.processHoroscopeUserMessage(message);
    }
  }
  private processHoroscopeUserMessage(message: string): void {
    this.currentMessage = '';
    this.isLoading = true;
    this.isTyping = true;

    // Agregar mensaje del usuario
    this.addMessage('user', message);

    const formData = this.userForm.value;
    const consultationData = {
      zodiacData: {
        name: 'High Priestess María',
        specialty: 'Western Astrology and Personalized Horoscope',
        experience: 'Decades of experience in astrological interpretation',
      },
      userMessage: message,
      fullName: formData.fullName,
      birthYear: formData.birthYear?.toString(),
      birthDate: formData.birthDate,
      conversationHistory: this.conversationHistory,
    };

    this.zodiacoChinoService.chatWithMaster(consultationData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.isTyping = false;
        if (response.success && response.response) {
          const messageId = Date.now().toString();

          this.addMessage('master', response.response, messageId);

          // ✅ LÓGICA ACTUALIZADA: Solo bloquear si NO tiene acceso premium Y no tiene consultas gratis
          if (
            this.firstQuestionAsked &&
            !this.hasUserPaidForHoroscope && // No tiene acceso premium
            !this.hasFreeHoroscopeConsultationsAvailable() // No tiene consultas gratis
          ) {
            this.blockedMessageId = messageId;
            this.storage.setBlockedMessageId('horoscope', messageId);

            setTimeout(() => {
              this.logger.log(
                '🔒 Mensaje horoscópico bloqueado - mostrando modal de datos'
              );
              this.saveHoroscopeStateBeforePayment();

              // Cerrar otros modales
              this.showFortuneWheel = false;
              this.showPaymentModal = false;

              // Mostrar modal de datos
              setTimeout(() => {
                this.showDataModal = true;
              }, 100);
            }, 2000);
          } else if (!this.firstQuestionAsked) {
            this.firstQuestionAsked = true;
            this.storage.markFirstQuestionAsked('horoscope');
          }

          this.saveHoroscopeMessagesToSession();
        } else {
          this.handleError('Error en la respuesta de la astróloga');
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.isTyping = false;
        this.handleError(
          'Error connecting with the astrologer: ' +
            (error.error?.error || error.message)
        );
      },
    });
  }

  // Manejar tecla Enter
  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // Alternar formulario
  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  // Reiniciar consulta
  resetConsultation(): void {
    this.conversationHistory = [];
    this.isFormCompleted = false;
    this.showDataForm = true;
    this.currentMessage = '';
    this.zodiacAnimal = {};
    this.firstQuestionAsked = false;
    this.blockedMessageId = null;

    // Limpiar sessionStorage específico del horóscopo
    if (!this.hasUserPaidForHoroscope) {
      this.clearHoroscopeSessionData();
    } else {
      this.storage.removeSessionItem('horoscopeMessages');
      this.storage.removeSessionItem('horoscopeFirstQuestionAsked');
      this.storage.removeBlockedMessageId('horoscope');
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

  // Explorar compatibilidad
  exploreCompatibility(): void {
    const message =
      'Could you tell me about the compatibility of my zodiac sign with other signs?';
    this.currentMessage = message;
    this.sendMessage();
  }


  // Métodos auxiliares
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
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      try {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      } catch (err) {
        this.logger.error('Error scrolling to bottom:', err);
      }
    }
  }

  private handleError(message: string): void {
    this.addMessage(
      'master',
      `'I'm sorry, ${message}. Please try again.`
    );
  }

  formatMessage(content: string): string {
    if (!content) return '';

    let formattedContent = content;

    // Convertir **texto** a <strong>texto</strong> para negrilla
    formattedContent = formattedContent.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );

    // Convertir saltos de línea a <br> para mejor visualización
    formattedContent = formattedContent.replace(/\n/g, '<br>');

    // Opcional: También puedes manejar *texto* (una sola asterisco) como cursiva
    formattedContent = formattedContent.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    return formattedContent;
  }

  formatTime(timestamp?: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackByMessage(index: number, message: ChatMessage): string {
    return `${message.role}-${message.timestamp}-${index}`;
  }

  closeModal(): void {
    // Implementar lógica de cierre de modal si es necesario
    this.logger.log('Cerrar modal');
  }

  // Auto-resize del textarea
  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  // Manejar tecla Enter
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // Limpiar chat
  clearChat(): void {
    this.conversationHistory = [];
    this.currentMessage = '';
    this.firstQuestionAsked = false;
    this.blockedMessageId = null;
    this.isLoading = false;

    // Limpiar sessionStorage específico del horóscopo (pero NO userData)
    this.storage.removeSessionItem('horoscopeMessages');
    this.storage.removeSessionItem('horoscopeFirstQuestionAsked');
    this.storage.removeBlockedMessageId('horoscope');

    this.shouldScrollToBottom = true;
    this.initializeHoroscopeWelcomeMessage();
  }
  resetChat(): void {
    this.logger.log('🔄 Iniciando reset completo del chat horoscópico...');

    // 1. Reset de arrays y mensajes
    this.conversationHistory = [];
    this.currentMessage = '';

    // 2. Reset de estados de carga y typing
    this.isLoading = false;
    this.isTyping = false;

    // 3. Reset de estados de formulario
    this.isFormCompleted = false;
    this.showDataForm = true;

    // 4. Reset de estados de pago y bloqueo
    this.firstQuestionAsked = false;
    this.blockedMessageId = null;

    // 5. Reset de modales
    this.showPaymentModal = false;
    this.showDataModal = false;
    this.showFortuneWheel = false;

    // 6. Reset de variables de scroll y contadores
    this.shouldScrollToBottom = false;
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0; // ← Esta era tu variable contador

    // 7. Reset del zodiac animal
    this.zodiacAnimal = {};

    // 8. Reset de payment variables
    this.isProcessingPayment = false;
    this.paymentError = null;

    // 9. Limpiar timers
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    // 10. Limpiar sessionStorage específico del horóscopo (pero NO userData)
    this.storage.removeSessionItem('horoscopeMessages');
    this.storage.removeSessionItem('horoscopeFirstQuestionAsked');
    this.storage.removeBlockedMessageId('horoscope');
    this.storage.removeSessionItem('pendingHoroscopeMessage');
    // NO limpiar 'userData' ni 'hasUserPaidForHoroscope'

    // 11. Reset del formulario
    this.userForm.reset({
      fullName: '',
      birthYear: '',
      birthDate: '',
      initialQuestion:
        '¿Qué puedes decirme sobre mi signo zodiacal y horóscopo?',
    });

    // 12. Reinicializar mensaje de bienvenida
    setTimeout(() => {
      this.initializeHoroscopeWelcomeMessage();
      this.logger.log('✅ Reset completo del chat horoscópico completado');
    }, 100);
  }
  onUserDataSubmitted(userData: any): void {
    this.logger.log('📥 Datos del usuario recibidos en horóscopo:', userData);
    this.logger.log('📋 Campos disponibles:', Object.keys(userData));

    // ✅ VALIDAR CAMPOS CRÍTICOS ANTES DE PROCEDER
    const requiredFields = ['email'];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      this.logger.error(
        '❌ Missing required fields for horoscope:',
        missingFields
      );
      alert(
        `To proceed with the payment, you need to complete: ${missingFields.join(
          ', '
        )}`
      );
      this.showDataModal = true; // Mantener modal abierto
      return;
    }

    // ✅ LIMPIAR Y GUARDAR datos INMEDIATAMENTE en memoria Y sessionStorage
    this.userData = {
      ...userData,
      email: userData.email?.toString().trim(),
    };

    // ✅ GUARDAR EN sessionStorage INMEDIATAMENTE
    try {
      this.storage.setUserData(this.userData);
      this.logger.log(
        '✅ Datos guardados en sessionStorage para horóscopo:',
        this.userData
      );

      // Verificar que se guardaron correctamente
      const verificacion = JSON.stringify(this.storage.getUserData());
      this.logger.log(
        '🔍 Verificación - Datos en sessionStorage para horóscopo:',
        verificacion ? JSON.parse(verificacion) : 'No encontrados'
      );
    } catch (error) {
      this.logger.error('❌ Error guardando en sessionStorage:', error);
    }

    this.showDataModal = false;

    // ✅ NUEVO: Enviar datos al backend como en otros componentes
    this.sendUserDataToBackend(userData);
  }
  private sendUserDataToBackend(userData: any): void {
    this.logger.log('📤 Enviando datos al backend desde horóscopo...');

    this.http.post(`${this.backendUrl}api/recolecta`, userData).subscribe({
      next: (response) => {
        this.logger.log(
          '✅ Datos enviados correctamente al backend desde horóscopo:',
          response
        );

        // ✅ PROCEDER AL PAGO DESPUÉS DE UN PEQUEÑO DELAY
        setTimeout(() => {
          this.promptForHoroscopePayment();
        }, 500);
      },
      error: (error) => {
        this.logger.error(
          '❌ Error enviando datos al backend desde horóscopo:',
          error
        );

        // ✅ AUN ASÍ PROCEDER AL PAGO (el backend puede fallar pero el pago debe continuar)
        this.logger.log('⚠️ Continuando con el pago a pesar del error del backend');
        setTimeout(() => {
          this.promptForHoroscopePayment();
        }, 500);
      },
    });
  }
  onDataModalClosed(): void {
    this.showDataModal = false;
  }
  showHoroscopeWheelAfterDelay(delayMs: number = 3000): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    this.logger.log('⏰ Timer horoscópico configurado para', delayMs, 'ms');

    this.wheelTimer = setTimeout(() => {
      this.logger.log('🎰 Verificando si puede mostrar ruleta horoscópica...');

      if (
        FortuneWheelComponent.canShowWheel() &&
        !this.showPaymentModal &&
        !this.showDataModal
      ) {
        this.logger.log('✅ Mostrando ruleta horoscópica - usuario puede girar');
        this.showFortuneWheel = true;
      } else {
        this.logger.log(
          '❌ No se puede mostrar ruleta horoscópica en este momento'
        );
      }
    }, delayMs);
  }

  onPrizeWon(prize: Prize): void {
    this.logger.log('🎉 Premio horoscópico ganado:', prize);

    const prizeMessage: ChatMessage = {
      role: 'master',
      message: `🔮 The stars have conspired in your favor! You have won: **${prize.name}** ${prize.icon}\n\nThe celestial forces have decided to bless you with this sacred gift. The zodiacal energy flows through you, revealing deeper secrets of your personal horoscope. May astrological wisdom illuminate your path!`,
      timestamp: new Date().toISOString(),
    };

    this.conversationHistory.push(prizeMessage);
    this.shouldScrollToBottom = true;
    this.saveHoroscopeMessagesToSession();

    this.processHoroscopePrize(prize);
  }

  onWheelClosed(): void {
    this.logger.log('🎰 Cerrando ruleta horoscópica');
    this.showFortuneWheel = false;
  }

  triggerHoroscopeWheel(): void {
    this.logger.log('🎰 Intentando activar ruleta horoscópica manualmente...');

    if (this.showPaymentModal || this.showDataModal) {
      this.logger.log('❌ No se puede mostrar - hay otros modales abiertos');
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.logger.log('✅ Activando ruleta horoscópica manualmente');
      this.showFortuneWheel = true;
    } else {
      this.logger.log(
        '❌ No se puede activar ruleta horoscópica - sin tiradas disponibles'
      );
      alert(
        'You dont have any spins ' +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }

  private processHoroscopePrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Lecturas Horoscópicas
        this.addFreeHoroscopeConsultations(3);
        break;
      case '2': // 1 Análisis Premium - ACCESO COMPLETO
        this.logger.log('🌟 Premio Premium ganado - Acceso ilimitado concedido');
        this.hasUserPaidForHoroscope = true;
        this.storage.setUserPaid('Horoscope', true);

        // Desbloquear cualquier mensaje bloqueado
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          this.storage.removeBlockedMessageId('horoscope');
          this.logger.log('🔓 Mensaje desbloqueado con acceso premium');
        }

        // Agregar mensaje especial para este premio
        const premiumMessage: ChatMessage = {
          role: 'master',
          message:
            '🌟 **You have unlocked full Premium access!** 🌟\n\nThe stars have smiled upon you in an extraordinary way. You now have unlimited access to all my astrological wisdom. You can inquire about your horoscope, compatibility, predictions, and all celestial mysteries as many times as you wish.\n\n✨ *The universe has opened all its doors for you* ✨',
          timestamp: new Date().toISOString(),
        };
        this.conversationHistory.push(premiumMessage);
        this.shouldScrollToBottom = true;
        this.saveHoroscopeMessagesToSession();
        break;
      // ✅ ELIMINADO: case '3' - 2 Consultas Extra
      case '4': // Otra oportunidad
        this.logger.log('🔄 Otra oportunidad horoscópica concedida');
        break;
      default:
        this.logger.warn('⚠️ Premio horoscópico desconocido:', prize);
    }
  }

  private addFreeHoroscopeConsultations(count: number): void {
    const current = parseInt(
      this.storage.getFreeConsultations('Horoscope').toString() || '0'
    );
    const newTotal = current + count;
    this.storage.setFreeConsultations('Horoscope', newTotal);
    this.logger.log(
      `🎁 Agregadas ${count} consultas horoscópicas. Total: ${newTotal}`
    );

    if (this.blockedMessageId && !this.hasUserPaidForHoroscope) {
      this.blockedMessageId = null;
      this.storage.removeBlockedMessageId('horoscope');
      this.logger.log('🔓 Mensaje horoscópico desbloqueado con consulta gratuita');
    }
  }

  private hasFreeHoroscopeConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('Horoscope').toString() || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeHoroscopeConsultation(): void {
    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('Horoscope').toString() || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      this.storage.setFreeConsultations('Horoscope', remaining);
      this.logger.log(
        `🎁 Consulta horoscópica gratis usada. Restantes: ${remaining}`
      );

      const prizeMsg: ChatMessage = {
        role: 'master',
        message: `✨ *You have used a free horoscope reading* ✨\n\nYou have **${remaining}** astrological consultations remaining.`,
        timestamp: new Date().toISOString(),
      };
      this.conversationHistory.push(prizeMsg);
      this.shouldScrollToBottom = true;
      this.saveHoroscopeMessagesToSession();
    }
  }

  debugHoroscopeWheel(): void {
    this.logger.log('=== DEBUG RULETA HOROSCÓPICA ===');
    this.logger.log('showFortuneWheel:', this.showFortuneWheel);
    this.logger.log(
      'FortuneWheelComponent.canShowWheel():',
      FortuneWheelComponent.canShowWheel()
    );
    this.logger.log('showPaymentModal:', this.showPaymentModal);
    this.logger.log('showDataModal:', this.showDataModal);
    this.logger.log(
      'freeHoroscopeConsultations:',
      this.storage.getFreeConsultations('Horoscope').toString()
    );

    this.showFortuneWheel = true;
    this.logger.log('Forzado showFortuneWheel a:', this.showFortuneWheel);
  }

  // ✅ MÉTODO AUXILIAR para el template
  getHoroscopeConsultationsCount(): number {
    return parseInt(
      this.storage.getFreeConsultations('Horoscope').toString() || '0'
    );
  }
}
