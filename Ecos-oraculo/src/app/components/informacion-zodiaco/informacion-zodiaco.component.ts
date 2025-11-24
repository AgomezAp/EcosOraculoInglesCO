import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { InformacionZodiacoService } from '../../services/informacion-zodiaco.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environments';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';
import { LoggerService } from '../../services/logger.service';
import { StorageService } from '../../services/storage.service';
import { PaypalService } from '../../services/paypal.service';
interface ZodiacMessage {
  content: string;
  isUser: boolean;
  timestamp: Date;
  sender: string;
}

// ✅ Definir AstrologerData según tu servicio
interface AstrologerData {
  name: string;
  title: string;
  specialty: string;
  experience: string;
}
interface ZodiacRequest {
  zodiacData: AstrologerData;
  userMessage: string;
  conversationHistory?: Array<{
    role: 'user' | 'astrologer';
    message: string;
  }>;
}

interface ZodiacResponse {
  success: boolean;
  response?: string;
  error?: string;
  timestamp: string;
}

interface AstrologerInfo {
  success: boolean;
  astrologer: {
    name: string;
    title: string;
    specialty: string;
    description: string;
  };
  timestamp: string;
}
@Component({
  selector: 'app-informacion-zodiaco',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
    FortuneWheelComponent,
  ],
  templateUrl: './informacion-zodiaco.component.html',
  styleUrl: './informacion-zodiaco.component.css',
})
export class InformacionZodiacoComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Variables principales del chat
  currentMessage: string = '';
  messages: any[] = [];
  isLoading = false;
  hasStartedConversation = false;

  // Variables de control de scroll
  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  showDataModal: boolean = false;
  userData: any = null;

  // Variables para control de pagos
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForAstrology: boolean = false;
  firstQuestionAsked: boolean = false;
  //Configuración de la rueda de la fortuna
  showFortuneWheel: boolean = false;
  astralPrizes: Prize[] = [
    {
      id: '1',
      name: '3 more roulette spins',
      color: '#4ecdc4',
      icon: '🔮',
    },
    { id: '2', name: '1 Premium Astral Reading', color: '#45b7d1', icon: '✨' },

    {
      id: '4',
      name: 'Try Again!',
      color: '#ff7675',
      icon: '🌙',
    },
  ];
  private wheelTimer: any;
  // NUEVA PROPIEDAD para controlar mensajes bloqueados
  blockedMessageId: string | null = null;
  /*   private stripePublishableKey = environment.stripePublicKey; */
  // Configuración de Stripe
  private backendUrl = environment.apiUrl;

  astrologerInfo = {
    name: 'High Priestess Carla',
    title: 'Stars Guardian',
    specialty: 'Specialist in Astrology and Zodiac Signs',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    'Welcome, cosmic soul. The stars have whispered your arrival... What zodiac mysteries do you wish to unravel today?',
    'The planets align to receive you. I am Master Carla, interpreter of astral designs. Which sign or celestial aspect would you like to explore?',
    'The cosmos vibrates with your presence... The constellations dance, awaiting your questions. Allow me to guide you through the paths of the zodiac.',
    'Ah, I see that the stars have directed you towards me. The secrets of the zodiac signs await to be revealed. What troubles you about the firmament?',
  ];

  constructor(
    private http: HttpClient,
    private zodiacoService: InformacionZodiacoService,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
    @Optional() public dialogRef: MatDialogRef<InformacionZodiacoComponent>,
    private logger: LoggerService,
    private storage: StorageService,
    private paypalService: PaypalService
  ) {}

  async ngOnInit(): Promise<void> {
    this.hasUserPaidForAstrology =
      this.storage.hasUserPaid('Astrology');

    // ✅ NUEVO: Cargar datos del usuario desde sessionStorage
    this.logger.log(
      '🔍 Cargando datos del usuario desde sessionStorage para astrología...'
    );
    const savedUserData = JSON.stringify(this.storage.getUserData());
    if (savedUserData) {
      try {
        this.userData = JSON.parse(savedUserData);
        this.logger.log(
          '✅ Datos del usuario restaurados para astrología:',
          this.userData
        );
      } catch (error) {
        this.logger.error('❌ Error al parsear datos del usuario:', error);
        this.userData = null;
      }
    } else {
      this.logger.log(
        'ℹ️ No hay datos del usuario guardados en sessionStorage para astrología'
      );
      this.userData = null;
    }

    const savedMessages = JSON.stringify(this.storage.getMessages('astrologyMessages'));
    const savedFirstQuestion = this.storage.isFirstQuestion('astrology') ? null : 'true';
    const savedBlockedMessageId = sessionStorage.getItem(
      'blockedAstrologyMessageId'
    );

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.messages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.firstQuestionAsked = savedFirstQuestion === 'true';
        this.blockedMessageId = savedBlockedMessageId || null;
        this.hasStartedConversation = true;
        this.logger.log(
          '✅ Mensajes de astrología restaurados desde sessionStorage'
        );
      } catch (error) {
        this.logger.error('Error al restaurar mensajes:', error);
        this.clearSessionData();
        this.startConversation();
      }
    } else {
      this.startConversation();
    }

    this.checkPaymentStatus();

    // ✅ AGREGAR: Mostrar ruleta si ya hay conversación iniciada
    if (this.hasStartedConversation && FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(2000);
    }
  }

  private async checkPaymentStatus(): Promise<void> {
    this.hasUserPaidForAstrology = this.storage.hasUserPaid('Astrology');

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          this.hasUserPaidForAstrology = true;
          this.storage.setUserPaid('Astrology', true);

          this.blockedMessageId = null;
          this.storage.removeBlockedMessageId('astrology');

          window.history.replaceState({}, document.title, window.location.pathname);

          this.showPaymentModal = false;
          this.isProcessingPayment = false;
          this.paymentError = null;

          setTimeout(() => {
            const confirmationMsg = {
              isUser: false,
              content:
                '🎉 Payment completed successfully!\n\n' +
                '✨ Thank you. You now have full access to Zodiac readings.\n\n' +
                '🌟 Let\'s explore the mysteries of the stars together!',
              timestamp: new Date(),
              sender: 'astrologer',
            };
            this.messages.push(confirmationMsg);
            this.saveMessagesToSession();

            const pendingMessage = this.storage.getSessionItem<string>('pendingAstrologyMessage');
            if (pendingMessage) {
              this.storage.removeSessionItem('pendingAstrologyMessage');
              setTimeout(() => {
                this.currentMessage = pendingMessage;
                this.sendMessage();
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

  ngAfterViewChecked(): void {
    if (this.shouldAutoScroll && this.messages.length > this.lastMessageCount) {
      this.scrollToBottom();
      this.lastMessageCount = this.messages.length;
    }
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }
  showWheelAfterDelay(delayMs: number = 3000): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    this.logger.log('⏰ Timer configurado para', delayMs, 'ms');

    this.wheelTimer = setTimeout(() => {
      this.logger.log('🎰 Verificando si puede mostrar ruleta...');

      if (
        FortuneWheelComponent.canShowWheel() &&
        !this.showPaymentModal &&
        !this.showDataModal
      ) {
        this.logger.log('✅ Mostrando ruleta astral - usuario puede girar');
        this.showFortuneWheel = true;
      } else {
        this.logger.log('❌ No se puede mostrar ruleta astral en este momento');
      }
    }, delayMs);
  }
  onPrizeWon(prize: Prize): void {
    this.logger.log('🎉 Premio astral ganado:', prize);

    // Mostrar mensaje del astrólogo sobre el premio
    const prizeMessage = {
      isUser: false,
      content: `🌟 Cosmic energies have blessed you! You have won: **${prize.name}** ${prize.icon}\n\nThis gift from the universe has been activated for you. The mysteries of the zodiac are revealed to you with greater clarity. May astral fortune accompany you in your upcoming consultations!`,
      timestamp: new Date(),
      isPrizeAnnouncement: true,
    };

    this.messages.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();

    // Procesar el premio
    this.processAstralPrize(prize);
  }
  onWheelClosed(): void {
    this.logger.log('🎰 Cerrando ruleta astral');
    this.showFortuneWheel = false;
  }

  triggerFortuneWheel(): void {
    this.logger.log('🎰 Intentando activar ruleta astral manualmente...');

    if (this.showPaymentModal || this.showDataModal) {
      this.logger.log('❌ No se puede mostrar - hay otros modales abiertos');
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.logger.log('✅ Activando ruleta astral manualmente');
      this.showFortuneWheel = true;
    } else {
      this.logger.log(
        '❌ No se puede activar ruleta astral - sin tiradas disponibles'
      );
      alert(
        'You have no spins available. ' +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }
  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }
  private processAstralPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Consultas Gratis
        this.addFreeAstrologyConsultations(3);
        break;
      case '2': // 1 Lectura Premium - ACCESO COMPLETO
        this.logger.log('✨ Premio Premium ganado - Acceso ilimitado concedido');
        this.hasUserPaidForAstrology = true;
        this.storage.setUserPaid('Astrology', true);

        // Desbloquear cualquier mensaje bloqueado
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          this.storage.removeBlockedMessageId('astrology');
          this.logger.log('🔓 Mensaje desbloqueado con acceso premium astral');
        }

        // Agregar mensaje especial para este premio
        const premiumMessage = {
          isUser: false,
          content:
            '✨ **You have unlocked full Premium access!** ✨\n\nThe stars have conspired in your favor in extraordinary ways. You now have unlimited access to all astrological wisdom. You can consult on zodiac signs, compatibilities, astrological predictions, and all celestial mysteries as many times as you wish.\n\n🌟 *The stars have opened all their cosmic doors for you* 🌟',
          timestamp: new Date(),
        };
        this.messages.push(premiumMessage);
        this.shouldAutoScroll = true;
        this.saveMessagesToSession();
        break;
      // ✅ ELIMINADO: case '3' - 2 Consultas Extra
      case '4': // Otra oportunidad
        this.logger.log('🔄 Otra oportunidad astral concedida');
        break;
      default:
        this.logger.warn('⚠️ Premio astral desconocido:', prize);
    }
  }
  private addFreeAstrologyConsultations(count: number): void {
    const current = parseInt(
      this.storage.getFreeConsultations('Astrology').toString() || '0'
    );
    const newTotal = current + count;
    this.storage.setFreeConsultations('Astrology', newTotal);
    this.logger.log(`🎁 Agregadas ${count} consultas astrales. Total: ${newTotal}`);

    // Si había un mensaje bloqueado, desbloquearlo
    if (this.blockedMessageId && !this.hasUserPaidForAstrology) {
      this.blockedMessageId = null;
      this.storage.removeBlockedMessageId('astrology');
      this.logger.log('🔓 Mensaje astral desbloqueado con consulta gratuita');
    }
  }

  private hasFreeAstrologyConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('Astrology').toString() || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeAstrologyConsultation(): void {
    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('Astrology').toString() || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      this.storage.setFreeConsultations('Astrology', remaining);
      this.logger.log(`🎁 Consulta astral gratis usada. Restantes: ${remaining}`);

      // Mostrar mensaje informativo
      const prizeMsg = {
        isUser: false,
        content: `✨ You have used a free astrological consultation ✨\n\nYou have **${remaining}** free astrological consultations left.`,
        timestamp: new Date(),
      };
      this.messages.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
    }
  }

  onScroll(event: any): void {
    const element = event.target;
    const threshold = 50;
    const isNearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      threshold;
    this.shouldAutoScroll = isNearBottom;
  }

  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  startConversation(): void {
    if (this.messages.length === 0) {
      const randomWelcome =
        this.welcomeMessages[
          Math.floor(Math.random() * this.welcomeMessages.length)
        ];

      const welcomeMessage = {
        isUser: false,
        content: randomWelcome,
        timestamp: new Date(),
      };

      this.messages.push(welcomeMessage);
    }
    this.hasStartedConversation = true;

    // ✅ AGREGAR VERIFICACIÓN DE RULETA
    if (FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(3000);
    } else {
      this.logger.log(
        '🚫 No se puede mostrar ruleta astral - sin tiradas disponibles'
      );
    }
  }

  sendMessage(): void {
    if (this.currentMessage?.trim() && !this.isLoading) {
      const userMessage = this.currentMessage.trim();

      // ✅ NUEVA LÓGICA: Verificar consultas gratuitas ANTES de verificar pago
      if (!this.hasUserPaidForAstrology && this.firstQuestionAsked) {
        // Verificar si tiene consultas astrales gratis disponibles
        if (this.hasFreeAstrologyConsultationsAvailable()) {
          this.logger.log('🎁 Usando consulta astral gratis del premio');
          this.useFreeAstrologyConsultation();
          // Continuar con el mensaje sin bloquear
        } else {
          // Si no tiene consultas gratis, mostrar modal de datos
          this.logger.log(
            '💳 No hay consultas astrales gratis - mostrando modal de datos'
          );

          // Cerrar otros modales primero
          this.showFortuneWheel = false;
          this.showPaymentModal = false;

          // Guardar el mensaje para procesarlo después del pago
          this.storage.setSessionItem('pendingAstrologyMessage', userMessage);

          this.saveStateBeforePayment();

          // Mostrar modal de datos con timeout
          setTimeout(() => {
            this.showDataModal = true;
            this.logger.log('📝 showDataModal establecido a:', this.showDataModal);
          }, 100);

          return; // Salir aquí para no procesar el mensaje aún
        }
      }

      this.shouldAutoScroll = true;

      // Procesar mensaje normalmente
      this.processUserMessage(userMessage);
    }
  }

  // ✅ NUEVO: Separar lógica de procesamiento de mensajes
  private processUserMessage(userMessage: string): void {
    const userMsg = {
      isUser: true,
      content: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isLoading = true;

    this.generateAstrologyResponse(userMessage).subscribe({
      next: (response: any) => {
        this.isLoading = false;

        const messageId = Date.now().toString();
        const astrologerMsg = {
          isUser: false,
          content: response,
          timestamp: new Date(),
          id: messageId,
        };
        this.messages.push(astrologerMsg);

        this.shouldAutoScroll = true;

        // ✅ LÓGICA MODIFICADA: Solo bloquear si no tiene consultas gratis Y no ha pagado
        if (
          this.firstQuestionAsked &&
          !this.hasUserPaidForAstrology &&
          !this.hasFreeAstrologyConsultationsAvailable()
        ) {
          this.blockedMessageId = messageId;
          this.storage.setBlockedMessageId('astrology', messageId);

          setTimeout(() => {
            this.logger.log(
              '🔒 Mensaje astral bloqueado - mostrando modal de datos'
            );
            this.saveStateBeforePayment();

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
          this.storage.markFirstQuestionAsked('astrology');
        }

        this.saveMessagesToSession();
      },
      error: (error: any) => {
        this.isLoading = false;
        this.logger.error('Error al obtener respuesta astrológica:', error);

        const errorMsg = {
          isUser: false,
          content:
            '🌟 Sorry, the cosmic energies are temporarily disturbed. Please try again in a few moments',
          timestamp: new Date(),
        };
        this.messages.push(errorMsg);
        this.saveMessagesToSession();
      },
    });
  }
  private generateAstrologyResponse(userMessage: string): Observable<string> {
    // Crear el historial de conversación para el contexto
    const conversationHistory = this.messages
      .filter((msg) => msg.content && msg.content.trim() !== '')
      .map((msg) => ({
        role: msg.isUser ? ('user' as const) : ('astrologer' as const),
        message: msg.content,
      }));

    // Datos del astrólogo
    const astrologerData: AstrologerData = {
      name: this.astrologerInfo.name,
      title: this.astrologerInfo.title,
      specialty: this.astrologerInfo.specialty,
      experience:
        'Centuries of experience interpreting celestial designs and the influence of the stars',
    };

    // ✅ Crear la solicitud con 'zodiacData' en lugar de 'astrologerData'
    const request: ZodiacRequest = {
      zodiacData: astrologerData, // ✅ Cambiar aquí
      userMessage,
      conversationHistory,
    };

    // Llamar al servicio y transformar la respuesta
    return this.zodiacoService.chatWithAstrologer(request).pipe(
      map((response: ZodiacResponse) => {
        if (response.success && response.response) {
          return response.response;
        } else {
          throw new Error(response.error || 'Error desconocido del servicio');
        }
      }),
      catchError((error: any) => {
        this.logger.error('Error en el servicio de astrología:', error);
        return of(
          '🌟 Sorry, the cosmic energies are temporarily disturbed. Please try again in a few moments.'
        );
      })
    );
  }

  private saveStateBeforePayment(): void {
    this.logger.log('💾 Guardando estado astral antes del pago...');
    this.saveMessagesToSession();
    sessionStorage.setItem(
      'firstAstrologyQuestionAsked',
      this.firstQuestionAsked.toString()
    );
    if (this.blockedMessageId) {
      sessionStorage.setItem(
        'blockedAstrologyMessageId',
        this.blockedMessageId
      );
    }
  }

  private saveMessagesToSession(): void {
    try {
      const messagesToSave = this.messages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      this.storage.setMessages('astrologyMessages', messagesToSave);
    } catch (error) {
      this.logger.error('Error guardando mensajes astrales:', error);
    }
  }

  private clearSessionData(): void {
    this.storage.removeSessionItem('hasUserPaidForAstrology');
    this.storage.removeSessionItem('astrologyMessages');
    this.storage.removeSessionItem('firstAstrologyQuestionAsked');
    this.storage.removeBlockedMessageId('astrology');
  }

  isMessageBlocked(message: any): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForAstrology
    );
  }

  async promptForPayment(): Promise<void> {
    this.logger.log('💳 EJECUTANDO promptForPayment() para astrología');

    this.showPaymentModal = true;
    this.paymentError = null;
    this.isProcessingPayment = true;

    try {
      // ✅ CARGAR DATOS DESDE sessionStorage SI NO ESTÁN EN MEMORIA
      if (!this.userData) {
        this.logger.log(
          '🔍 userData no está en memoria, cargando desde sessionStorage para astrología...'
        );
        const savedUserData = JSON.stringify(this.storage.getUserData());
        if (savedUserData) {
          try {
            this.userData = JSON.parse(savedUserData);
            this.logger.log(
              '✅ Datos cargados desde sessionStorage para astrología:',
              this.userData
            );
          } catch (error) {
            this.logger.error('❌ Error al parsear datos guardados:', error);
            this.userData = null;
          }
        }
      }

      // ✅ VALIDAR DATOS ANTES DE CREAR customerInfo
      this.logger.log(
        '🔍 Validando userData completo para astrología:',
        this.userData
      );

      if (!this.userData) {
        this.logger.error('❌ No hay userData disponible para astrología');
        this.paymentError =
          'No client data found. Please complete the form first.';
        this.isProcessingPayment = false;
        this.showDataModal = true;
        return;
      }

      const email = this.userData.email?.toString().trim();

      if (!email) {
        this.logger.error('❌ Faltan campos requeridos para el pago de astrología');
        this.paymentError = 'Email is required. Please complete the form first.';
        this.isProcessingPayment = false;
        this.showDataModal = true;
        return;
      }

      // Store pending message
      if (this.currentMessage && this.currentMessage.trim()) {
        this.storage.setSessionItem('pendingAstrologyMessage', this.currentMessage.trim());
      }

      const orderData = {
        amount: '7.00',
        currency: 'USD',
        serviceName: 'Zodiac Information',
        returnPath: '/zodiac-info',
        cancelPath: '/zodiac-info',
        customerEmail: email,
      };

      await this.paypalService.initiatePayment(orderData);
    } catch (error: any) {
      this.logger.error('❌ Error al preparar el pago astral:', error);
      this.paymentError =
        error.message || 'Error preparing the payment. Please try again.';
      this.isProcessingPayment = false;
    }
  }
  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;

    try {
      const email = this.userData?.email?.toString().trim();

      if (!email) {
        this.paymentError = 'Email is required';
        this.isProcessingPayment = false;
        return;
      }

      if (this.currentMessage && this.currentMessage.trim()) {
        this.storage.setSessionItem('pendingAstrologyMessage', this.currentMessage.trim());
      }

      const orderData = {
        amount: '7.00',
        currency: 'USD',
        serviceName: 'Zodiac Information',
        returnPath: '/zodiac-info',
        cancelPath: '/zodiac-info',
        customerEmail: email,
      };

      await this.paypalService.initiatePayment(orderData);
    } catch (error: any) {
      this.logger.error('❌ Error en handlePaymentSubmit:', error);
      this.paymentError = error.message || 'Error processing payment';
      this.isProcessingPayment = false;
    }
  }

  cancelPayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
  }

  clearConversation(): void {
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    if (!this.hasUserPaidForAstrology) {
      this.firstQuestionAsked = false;
      this.blockedMessageId = null;
      this.clearSessionData();
    } else {
      this.storage.removeSessionItem('astrologyMessages');
      this.storage.removeSessionItem('firstAstrologyQuestionAsked');
      this.storage.removeBlockedMessageId('astrology');
      this.firstQuestionAsked = false;
      this.blockedMessageId = null;
    }

    this.messages = [];
    this.hasStartedConversation = false;
    setTimeout(() => {
      this.startConversation();
    }, 500);
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {
      this.logger.error('Error scrolling to bottom:', err);
    }
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

  // Métodos específicos del zodíaco - implementa según tu lógica
  getZodiacSymbol(sign: string): string {
    // Implementar lógica para símbolos del zodíaco
    return '♈'; // Ejemplo
  }

  getZodiacElement(sign: string): string {
    // Implementar lógica para elementos
    return 'Fuego'; // Ejemplo
  }

  getZodiacModality(sign: string): string {
    // Implementar lógica para modalidades
    return 'Cardinal'; // Ejemplo
  }
  onUserDataSubmitted(userData: any): void {
    this.logger.log('📥 Datos del usuario recibidos en astrología:', userData);
    this.logger.log('📋 Campos disponibles:', Object.keys(userData));

    // ✅ VALIDAR CAMPOS CRÍTICOS ANTES DE PROCEDER
    const requiredFields = ['email',];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      this.logger.error(
        '❌ Faltan campos obligatorios para astrología:',
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
        '✅ Datos guardados en sessionStorage para astrología:',
        this.userData
      );

      // Verificar que se guardaron correctamente
      const verificacion = JSON.stringify(this.storage.getUserData());
      this.logger.log(
        '🔍 Verificación - Datos en sessionStorage para astrología:',
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
    this.logger.log('📤 Enviando datos al backend desde astrología...');

    this.http.post(`${this.backendUrl}api/recolecta`, userData).subscribe({
      next: (response) => {
        this.logger.log(
          '✅ Datos enviados correctamente al backend desde astrología:',
          response
        );

        // ✅ PROCEDER AL PAGO DESPUÉS DE UN PEQUEÑO DELAY
        setTimeout(() => {
          this.promptForPayment();
        }, 500);
      },
      error: (error) => {
        this.logger.error(
          '❌ Error enviando datos al backend desde astrología:',
          error
        );

        // ✅ AUN ASÍ PROCEDER AL PAGO (el backend puede fallar pero el pago debe continuar)
        this.logger.log('⚠️ Continuando con el pago a pesar del error del backend');
        setTimeout(() => {
          this.promptForPayment();
        }, 500);
      },
    });
  }
  onDataModalClosed(): void {
    this.showDataModal = false;
  }
}
