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
  ConversationMessage,
  DreamInterpreterData,
  InterpretadorSuenosService,
} from '../../services/interpretador-suenos.service';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environments';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';
import { LoggerService } from '../../services/logger.service';
import { StorageService } from '../../services/storage.service';
import { PaypalService } from '../../services/paypal.service';
@Component({
  selector: 'app-significado-suenos',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
    FortuneWheelComponent,
  ],
  templateUrl: './significado-suenos.component.html',
  styleUrl: './significado-suenos.component.css',
})
export class SignificadoSuenosComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Variables principales del chat
  messageText: string = '';
  messageInput = new FormControl('');
  messages: ConversationMessage[] = [];
  isLoading = false;
  isTyping = false;
  hasStartedConversation = false;

  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  showFortuneWheel: boolean = false;
  wheelPrizes: Prize[] = [
    {
      id: '1',
      name: '3 Tiradas más',
      color: '#4ecdc4',
      icon: '🌙',
    },
    {
      id: '2',
      name: '1 Premium Analisis',
      color: '#45b7d1',
      icon: '✨',
    },
    {
      id: '4',
      name: '¡Try again!',
      color: '#ff7675',
      icon: '🔄',
    },
  ];
  private wheelTimer: any;

  //Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;

  // Variables para control de pagos con PayPal
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForDreams: boolean = false;
  firstQuestionAsked: boolean = false;

  // NUEVA PROPIEDAD para controlar mensajes bloqueados
  blockedMessageId: string | null = null;

  textareaHeight: number = 25; // Altura inicial
  private readonly minTextareaHeight = 45;
  private readonly maxTextareaHeight = 120;

  // Configuración de Stripe desde environment
  private backendUrl = environment.apiUrl;

  interpreterData: DreamInterpreterData = {
    name: 'High Priestess Alma',
    specialty: 'Dream interpretation and oniric messages',
    experience: 'Centuries interpreting the messages of the subconscious',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    'Ah, I see you have come to me seeking to unravel the mysteries of your dream world... Dreams are windows to the soul. Tell me, what visions have visited you?',
    'The cosmic energies whisper to me that you have dreams in need of interpretation. I am High Priestess Alma, guardian of dreamlike secrets. What message from the subconscious troubles you?',
    'Welcome, dream traveler. The astral planes have shown me your arrival. Allow me to guide you through the symbols and mysteries of your nocturnal visions.',
    'The dream crystal illuminates before your presence... I sense that you carry visions that need deciphering. Trust in my ancestral wisdom and share your dreams with me.',
  ];

  constructor(
    private dreamService: InterpretadorSuenosService,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>,
    private logger: LoggerService,
    private storage: StorageService,
    private paypalService: PaypalService
  ) {}
  ngAfterViewInit(): void {
    this.setVideosSpeed(0.66); // 0.5 = más lento, 1 = normal
  }
  async ngOnInit(): Promise<void> {
    // Usar StorageService en lugar de sessionStorage directo
    this.hasUserPaidForDreams = this.storage.hasUserPaidForDreams();
    this.userData = this.storage.getUserData();

    this.logger.info('User data loaded:', this.userData);

    const savedMessages = this.storage.getDreamMessages();
    const savedFirstQuestion = this.storage.getSessionItem<boolean>('firstQuestionAsked');
    const savedBlockedMessageId = this.storage.getSessionItem<string>('blockedMessageId');

    if (savedMessages && savedMessages.length > 0) {
      try {
        this.messages = savedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.firstQuestionAsked = savedFirstQuestion || false;
        this.blockedMessageId = savedBlockedMessageId || null;
        this.hasStartedConversation = true;
        this.logger.info('Messages restored from storage');
      } catch (error) {
        this.logger.error('Error restoring messages:', error);
        this.clearSessionData();
        this.startConversation();
      }
    } else {
      this.startConversation();
    }
    
    await this.checkPaymentStatus();
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

  showWheelAfterDelay(delayMs: number = 3000): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    this.logger.log('⏰ Timer configurado para', delayMs, 'ms');

    this.wheelTimer = setTimeout(() => {
      this.logger.log('🎰 Verificando si puede mostrar ruleta...');

      // ✅ USAR MÉTODO ESTÁTICO DEL COMPONENTE RULETA
      if (
        FortuneWheelComponent.canShowWheel() &&
        !this.showPaymentModal &&
        !this.showDataModal
      ) {
        this.logger.log('✅ Mostrando ruleta - usuario puede girar');
        this.showFortuneWheel = true;
      } else {
        this.logger.log('❌ No se puede mostrar ruleta en este momento');
      }
    }, delayMs);
  }

  onPrizeWon(prize: Prize): void {
    this.logger.log('🎉 Premio onírico ganado:', prize);

    // Mostrar mensaje del intérprete sobre el premio
    const prizeMessage: ConversationMessage = {
      role: 'interpreter',
      message: `🌙 Cosmic energies have blessed you! You have won: **${prize.name}** ${prize.icon}\n\nThis gift from the oniric universe has been activated for you. The mysteries of dreams are revealed to you with greater clarity. May fortune accompany you in your future interpretations!`,
      timestamp: new Date(),
    };

    this.messages.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();

    // Procesar el premio
    this.processDreamPrize(prize);
  }
  private processDreamPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Interpretaciones Gratis
        this.addFreeDreamConsultations(3);
        break;
      case '2': // 1 Análisis Premium - ACCESO COMPLETO
        this.logger.log('✨ Premio Premium ganado - Acceso ilimitado concedido');
        this.hasUserPaidForDreams = true;
        this.storage.setUserPaid('Dreams', true);

        // Desbloquear cualquier mensaje bloqueado
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          this.storage.removeBlockedMessageId('');
          this.logger.log('🔓 Mensaje desbloqueado con acceso premium de sueños');
        }

        // Agregar mensaje especial para este premio
        const premiumMessage: ConversationMessage = {
          role: 'interpreter',
          message:
            '✨ **You have unlocked Premium access!** ✨\n\nThe mysteries of the dream world have smiled upon you in extraordinary ways. You now have unlimited access to all the wisdom of dreams. You can inquire about interpretations, dream symbolism, and all the secrets of the subconscious as many times as you wish.\n\n🌙 *The doors to the realm of dreams have fully opened for you* 🌙',
          timestamp: new Date(),
        };
        this.messages.push(premiumMessage);
        this.shouldAutoScroll = true;
        this.saveMessagesToSession();
        break;
      // ✅ ELIMINADO: case '3' - 2 Consultas Extra
      case '4': // Otra oportunidad
        this.logger.log('🔄 Otra oportunidad onírica concedida');
        break;
      default:
        this.logger.warn('⚠️ Premio onírico desconocido:', prize);
    }
  }
  private addFreeDreamConsultations(count: number): void {
    const current = parseInt(
      this.storage.getFreeConsultations('Dream').toString() || '0'
    );
    const newTotal = current + count;
    this.storage.setFreeConsultations('Dream', newTotal);
    this.logger.log(
      `🎁 Agregadas ${count} consultas de sueños. Total: ${newTotal}`
    );

    // Si había un mensaje bloqueado, desbloquearlo
    if (this.blockedMessageId && !this.hasUserPaidForDreams) {
      this.blockedMessageId = null;
      this.storage.removeBlockedMessageId('');
      this.logger.log('🔓 Mensaje onírico desbloqueado con consulta gratuita');
    }
  }
  openDataModalForPayment(): void {
    this.logger.log('🔓 Abriendo modal de datos para desbloquear mensaje onírico');

    // Cerrar otros modales que puedan estar abiertos
    this.showFortuneWheel = false;
    this.showPaymentModal = false;

    // Guardar el estado antes de proceder
    this.saveStateBeforePayment();

    // Abrir el modal de recolecta de datos
    setTimeout(() => {
      this.showDataModal = true;
      this.logger.log('📝 Modal de datos abierto para desbloqueo onírico');
    }, 100);
  }
  getDreamConsultationsCount(): number {
    const freeDreamConsultations = parseInt(
      this.storage.getFreeConsultations('Dream').toString() || '0'
    );
    const legacyFreeConsultations = parseInt(
      this.storage.getFreeConsultations('').toString() || '0'
    );

    return freeDreamConsultations + legacyFreeConsultations;
  }
  // Cerrar la ruleta
  onWheelClosed(): void {
    this.showFortuneWheel = false;
  }

  private async checkPaymentStatus(): Promise<void> {
    this.hasUserPaidForDreams = this.storage.hasUserPaid('Dreams');

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          this.hasUserPaidForDreams = true;
          this.storage.setUserPaid('Dreams', true);

          this.blockedMessageId = null;
          this.storage.removeBlockedMessageId('dreams');

          window.history.replaceState({}, document.title, window.location.pathname);

          this.showPaymentModal = false;
          this.isProcessingPayment = false;
          this.paymentError = null;

          setTimeout(() => {
            const confirmationMsg: ConversationMessage = {
              role: 'interpreter',
              message:
                '🎉 Payment completed successfully!\n\n' +
                '✨ Thank you. You now have full access to Dream Interpretation.\n\n' +
                '🌙 Let\'s uncover the mysteries of your dreams together!',
              timestamp: new Date(),
            };
            this.messages.push(confirmationMsg);
            this.shouldAutoScroll = true;
            this.saveMessagesToSession();

            const pendingMessage = this.storage.getSessionItem<string>('pendingDreamMessage');
            if (pendingMessage) {
              this.storage.removeSessionItem('pendingDreamMessage');
              setTimeout(() => {
                this.messageText = pendingMessage;
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
  onScroll(event: any): void {
    const element = event.target;
    const threshold = 50; // píxeles desde el bottom
    const isNearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      threshold;
    this.shouldAutoScroll = isNearBottom;
  }
  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }
  triggerFortuneWheel(): void {
    this.logger.log('🎰 Intentando activar ruleta manualmente...');

    if (this.showPaymentModal || this.showDataModal) {
      this.logger.log('❌ No se puede mostrar - hay otros modales abiertos');
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.logger.log('✅ Activando ruleta manualmente');
      this.showFortuneWheel = true;
    } else {
      this.logger.log('❌ No se puede activar ruleta - sin tiradas disponibles');
      alert(
        'You don\'t have any spins available. ' +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }
  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }
  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  startConversation(): void {
    // Solo agregar mensaje de bienvenida si no hay mensajes
    if (this.messages.length === 0) {
      const randomWelcome =
        this.welcomeMessages[
          Math.floor(Math.random() * this.welcomeMessages.length)
        ];

      const welcomeMessage: ConversationMessage = {
        role: 'interpreter',
        message: randomWelcome,
        timestamp: new Date(),
      };

      this.messages.push(welcomeMessage);
    }
    this.hasStartedConversation = true;

    // ✅ VERIFICACIÓN SIMPLIFICADA
    if (FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(3000);
    } else {
      this.logger.log('🚫 No se puede mostrar ruleta - sin tiradas disponibles');
    }
  }

  sendMessage(): void {
    if (this.messageText?.trim() && !this.isLoading) {
      const userMessage = this.messageText.trim();

      // ✅ NUEVA LÓGICA: Verificar premios disponibles ANTES de bloquear
      if (!this.hasUserPaidForDreams && this.firstQuestionAsked) {
        // Verificar si tiene consultas gratis disponibles
        if (this.hasFreeConsultationsAvailable()) {
          this.logger.log('🎁 Usando consulta gratis del premio');
          this.useFreeConsultation();
          // Continuar con el mensaje sin bloquear
        } else {
          // Si no tiene consultas gratis, mostrar modal de datos PRIMERO
          this.logger.log('💳 No hay consultas gratis - mostrando modal de datos');

          // ✅ Cerrar otros modales primero
          this.showFortuneWheel = false;
          this.showPaymentModal = false;

          // ✅ Guardar el mensaje para procesarlo después del pago
          this.storage.setSessionItem('pendingUserMessage', userMessage);

          this.saveStateBeforePayment();

          // ✅ Mostrar modal de datos con timeout para asegurar el cambio
          setTimeout(() => {
            this.showDataModal = true;
            this.logger.log('📝 showDataModal establecido a:', this.showDataModal);
          }, 100);

          return; // ✅ Salir aquí para no procesar el mensaje aún
        }
      }

      // ✅ ACTIVAR AUTO-SCROLL cuando se envía un mensaje
      this.shouldAutoScroll = true;

      // ✅ Procesar el mensaje normalmente
      this.processUserMessage(userMessage);
    }
  }
  private processUserMessage(userMessage: string): void {
    const userMsg: ConversationMessage = {
      role: 'user',
      message: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    this.saveMessagesToSession();
    this.messageText = '';
    this.isTyping = true;
    this.isLoading = true;

    const conversationHistory = this.messages.slice(0, -1);

    this.dreamService
      .chatWithInterpreter({
        interpreterData: this.interpreterData,
        userMessage: userMessage,
        conversationHistory: conversationHistory,
      })
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.isTyping = false;

          if (response.success && response.response) {
            const messageId = Date.now().toString();

            const interpreterMsg: ConversationMessage = {
              role: 'interpreter',
              message: response.response,
              timestamp: new Date(),
              id: messageId,
            };
            this.messages.push(interpreterMsg);

            this.shouldAutoScroll = true;

            // ✅ ACTUALIZADA: Solo bloquear si no tiene consultas gratis Y no ha pagado
            if (
              this.firstQuestionAsked &&
              !this.hasUserPaidForDreams &&
              !this.hasFreeConsultationsAvailable()
            ) {
              this.blockedMessageId = messageId;
              this.storage.setBlockedMessageId('', messageId);

              // ✅ CAMBIO: Mostrar modal de datos en lugar de ir directo al pago
              setTimeout(() => {
                this.logger.log('🔒 Mensaje bloqueado - mostrando modal de datos');
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
              this.storage.markFirstQuestionAsked('');
            }

            this.saveMessagesToSession();
          } else {
            this.handleError('Error al obtener respuesta del intérprete');
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.isTyping = false;
          this.logger.error('Error:', error);
          this.handleError('Error de conexión. Por favor, inténtalo de nuevo.');
        },
      });
  }
  // ✅ NUEVO: Verificar si tiene consultas gratis disponibles
  private hasFreeConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('').toString() || '0'
    );

    this.logger.log(
      '🔍 Verificando consultas gratis disponibles:',
      freeConsultations
    );
    this.logger.log(
      '🔍 Estado actual - hasUserPaidForDreams:',
      this.hasUserPaidForDreams
    );
    this.logger.log(
      '🔍 Estado actual - firstQuestionAsked:',
      this.firstQuestionAsked
    );

    return freeConsultations > 0;
  }

  // ✅ NUEVO: Usar una consulta gratis
  private useFreeConsultation(): void {
    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('').toString() || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      this.storage.setFreeConsultations('', parseInt(remaining.toString()));
      this.logger.log(`🎁 Consulta gratis usada. Restantes: ${remaining}`);

      // Mostrar mensaje informativo
      const prizeMsg: ConversationMessage = {
        role: 'interpreter',
        message: `✨ You have used one free consultation ✨\n\nYou have **${remaining}** free consultations left.`,
        timestamp: new Date(),
      };
      this.messages.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
    }
  }

  // ✅ NUEVO: Mostrar mensaje cuando se usa un premio
  private showPrizeUsageMessage(): void {
    const prizeMsg: ConversationMessage = {
      role: 'interpreter',
      message:
        '✨ *You have used one of your mystical rewards earned in the wheel* ✨\n\nCosmic energies flow in your favor. Continue with your consultation!',
      timestamp: new Date(),
    };

    this.messages.push(prizeMsg);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();
  }

  // ✅ NUEVO: Obtener resumen de premios disponibles
  getPrizesAvailable(): string {
    const prizes: string[] = [];

    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('').toString() || '0'
    );
    if (freeConsultations > 0) {
      prizes.push(
        `${freeConsultations} consulta${
          freeConsultations > 1 ? 's' : ''
        } gratis`
      );
    }

    const freeInterpretations = parseInt(
      this.storage.getFreeConsultations('Interpretation').toString() || '0'
    );
    if (freeInterpretations > 0) {
      prizes.push(
        `${freeInterpretations} interpretación${
          freeInterpretations > 1 ? 'es' : ''
        } gratis`
      );
    }

    if (this.storage.getSessionItem('hasVIPConsultation') === 'true') {
      prizes.push('1 consulta VIP');
    }

    if (this.storage.getSessionItem('hasPremiumReading') === 'true') {
      prizes.push('1 lectura premium');
    }

    if (this.storage.getSessionItem('hasMysticBonus') === 'true') {
      prizes.push('Bonus místico activo');
    }

    return prizes.length > 0 ? prizes.join(', ') : 'Ninguna';
  }

  private saveStateBeforePayment(): void {
    this.logger.log('💾 Guardando estado antes del pago...');
    this.saveMessagesToSession();
    this.storage.markFirstQuestionAsked('');
    if (this.blockedMessageId) {
      this.storage.setBlockedMessageId('', this.blockedMessageId);
    }
  }

  // ✅ ARREGLO: Método para guardar mensajes corregido
  private saveMessagesToSession(): void {
    try {
      const messagesToSave = this.messages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      this.storage.setDreamMessages(messagesToSave);
    } catch (error) {
      this.logger.error('Error guardando mensajes:', error);
    }
  }

  // ✅ NUEVO: Método para limpiar datos de sesión
  private clearSessionData(): void {
    this.storage.removeSessionItem('hasUserPaidForDreams');
    this.storage.removeSessionItem('dreamMessages');
    this.storage.removeSessionItem('firstQuestionAsked');
    this.storage.removeBlockedMessageId('');
  }

  // MÉTODO PARA VERIFICAR SI UN MENSAJE ESTÁ BLOQUEADO
  isMessageBlocked(message: ConversationMessage): boolean {
    return message.id === this.blockedMessageId && !this.hasUserPaidForDreams;
  }

  async promptForPayment(): Promise<void> {
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

    if (this.messageText) {
      this.storage.setSessionItem('pendingDreamMessage', this.messageText);
    }
  }

  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;

    try {
      const orderData = {
        amount: '7.00',
        currency: 'USD',
        serviceName: 'Dream Interpretation',
        returnPath: '/dream-meaning',
        cancelPath: '/dream-meaning',
      };

      await this.paypalService.initiatePayment(orderData);
    } catch (error: any) {
      this.paymentError = error.message || 'Error initializing PayPal payment.';
      this.isProcessingPayment = false;
    }
  }

  cancelPayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
  }

  adjustTextareaHeight(event: any): void {
    const textarea = event.target;

    // Resetear altura para obtener scrollHeight correcto
    textarea.style.height = 'auto';

    // Calcular nueva altura basada en el contenido
    const newHeight = Math.min(
      Math.max(textarea.scrollHeight, this.minTextareaHeight),
      this.maxTextareaHeight
    );

    // Aplicar nueva altura
    this.textareaHeight = newHeight;
    textarea.style.height = newHeight + 'px';
  }
  // Método para nueva consulta (resetear solo si no ha pagado)
  newConsultation(): void {
    // ✅ RESETEAR CONTROL DE SCROLL
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    if (!this.hasUserPaidForDreams) {
      this.firstQuestionAsked = false;
      this.blockedMessageId = null;
      this.clearSessionData();
    } else {
      this.storage.removeSessionItem('dreamMessages');
      this.storage.removeSessionItem('firstQuestionAsked');
      this.storage.removeBlockedMessageId('');
      this.firstQuestionAsked = false;
      this.blockedMessageId = null;
    }

    this.messages = [];
    this.hasStartedConversation = false;
    setTimeout(() => {
      this.startConversation();
    }, 500);
  }

  private handleError(errorMessage: string): void {
    const errorMsg: ConversationMessage = {
      role: 'interpreter',
      message: `🔮 The cosmic energies are disturbed... ${errorMessage} Please try again when the vibrations stabilize.`,
      timestamp: new Date(),
    };
    this.messages.push(errorMsg);

    // ✅ ACTIVAR AUTO-SCROLL para mensajes de error
    this.shouldAutoScroll = true;
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

  clearConversation(): void {
    this.newConsultation();
  }

  // Actualizar el método onKeyPress
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.messageText?.trim() && !this.isLoading) {
        this.sendMessage();
        // Resetear altura del textarea después del envío
        setTimeout(() => {
          this.textareaHeight = this.minTextareaHeight;
        }, 50);
      }
    }
  }

  getTimeString(timestamp: Date | string): string {
    try {
      // Si es string, convertir a Date
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

      // Verificar que sea una fecha válida
      if (isNaN(date.getTime())) {
        return 'N/A';
      }

      return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      this.logger.error('Error formateando timestamp:', error);
      return 'N/A';
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
  onUserDataSubmitted(userData: any): void {
    this.logger.log('📥 Datos del usuario recibidos:', userData);
    this.logger.log('📋 Campos disponibles:', Object.keys(userData));

    // ✅ VALIDAR CAMPOS CRÍTICOS ANTES DE PROCEDER
    const requiredFields = ['email'];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      this.logger.error('❌ Missing data:', missingFields);
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
      this.logger.log('✅ Datos guardados en sessionStorage:', this.userData);

      // Verificar que se guardaron correctamente
      const verificacion = JSON.stringify(this.storage.getUserData());
      this.logger.log(
        '🔍 Verificación - Datos en sessionStorage:',
        verificacion ? JSON.parse(verificacion) : 'No encontrados'
      );
    } catch (error) {
      this.logger.error('❌ Error guardando en sessionStorage:', error);
    }

    this.showDataModal = false;

    // Enviar datos al backend (opcional, no bloquea el pago)
    this.sendUserDataToBackend(userData);
  }
  private sendUserDataToBackend(userData: any): void {
    this.logger.log('📤 Enviando datos al backend...');

    this.http.post(`${this.backendUrl}api/recolecta`, userData).subscribe({
      next: (response) => {
        this.logger.log('✅ Datos enviados correctamente al backend:', response);

        // ✅ PROCEDER AL PAGO DESPUÉS DE UN PEQUEÑO DELAY
        setTimeout(() => {
          this.promptForPayment();
        }, 500);
      },
      error: (error) => {
        this.logger.error('❌ Error enviando datos al backend:', error);

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
