import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  ViewChild,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { NumerologiaService } from '../../services/numerologia.service';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
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

interface NumerologyMessage {
  sender: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  id?: string;
}
interface ConversationMessage {
  role: 'user' | 'numerologist';
  message: string;
  timestamp: Date;
  id?: string;
}

@Component({
  selector: 'app-historia-sagrada',
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
  templateUrl: './lectura-numerologia.component.html',
  styleUrl: './lectura-numerologia.component.css',
})
export class LecturaNumerologiaComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Variables principales del chat
  messages: ConversationMessage[] = [];
  currentMessage: string = '';
  messageInput = new FormControl('');
  isLoading: boolean = false;
  isTyping: boolean = false;
  hasStartedConversation: boolean = false;
  showDataForm: boolean = false;

  private shouldAutoScroll = true;
  private lastMessageCount = 0;
  //Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;

  // Variables para control de pagos con PayPal
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForNumerology: boolean = false;
  firstQuestionAsked: boolean = false;
  //Modal de rueda de la fortuna
  showFortuneWheel: boolean = false;
  numerologyPrizes: Prize[] = [
    {
      id: '1',
      name: '3 roulette spins',
      color: '#4ecdc4',
      icon: '🔢',
    },
    {
      id: '2',
      name: '1 Premium Numerological Analysis',
      color: '#45b7d1',
      icon: '✨',
    },
    {
      id: '4',
      name: 'Try again!',
      color: '#ff7675',
      icon: '🔄',
    },
  ];
  private wheelTimer: any;
  // NUEVA PROPIEDAD para controlar mensajes bloqueados
  blockedMessageId: string | null = null;
  /*     'pk_live_51ROf7JKaf976EMQYuG2XY0OwKWFcea33O5WxIDBKEeoTDqyOUgqmizQ2knrH6MCnJlIoDQ95HJrRhJaL0jjpULHj00sCSWkBw6';*/
  // Configuración de Stripe
  private backendUrl = environment.apiUrl;

  // Datos personales
  fullName: string = '';
  birthDate: string = '';

  // Números calculados
  personalNumbers = {
    lifePath: 0,
    destiny: 0,
  };

  // Info del numerólogo
  numerologistInfo = {
    name: 'High Priestess Sofía',
    title: 'Sacred Guardian of the Sacred Numbers',
    specialty: 'Numerology and universal numerical vibration',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    'Greetings, seeker of numerical wisdom... Numbers are the language of the universe, and they reveal the secrets of your destiny. What would you like to discover about your numerological vibration?',
    'The numerical energies whisper to me that you have come seeking answers... I am High Priestess Sophia, guardian of the sacred numbers. What numerical mystery troubles your heart?',
    'Welcome to the temple of sacred numbers. The mathematical patterns of the cosmos have announced your arrival. Allow me to reveal the secrets of your numerological code.',
    'The numbers dance before me, revealing your presence... Each number carries a meaning, each calculation unveils a destiny. Which numbers would you like me to interpret for you?',
  ];

  constructor(
    @Optional() public dialogRef: MatDialogRef<LecturaNumerologiaComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
    private numerologyService: NumerologiaService,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>,
    private logger: LoggerService,
    private storage: StorageService,
    private paypalService: PaypalService
  ) {}
  ngAfterViewInit(): void {
    this.setVideosSpeed(0.67); // 0.5 = más lento, 1 = normal
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
  

    this.hasUserPaidForNumerology =
      this.storage.hasUserPaid('Numerology');

    // ✅ MEJORADO: Cargar datos del usuario desde sessionStorage
    this.logger.log(
      '🔍 Cargando datos del usuario desde sessionStorage para numerología...'
    );

    // ✅ MOSTRAR TODO EL CONTENIDO DE sessionStorage
    this.logger.log('🔍 Contenido completo de sessionStorage:');
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        const value = sessionStorage.getItem(key) // TODO: migrate individual keys;
        this.logger.log(`  - ${key}:`, value);
      }
    }

    const savedUserData = JSON.stringify(this.storage.getUserData());
    this.logger.log('🔍 Datos específicos de userData:', savedUserData);

    if (savedUserData) {
      try {
        this.userData = JSON.parse(savedUserData);
        this.logger.log(
          '✅ Datos del usuario restaurados para numerología:',
          this.userData
        );

        // ✅ VALIDAR QUE LOS CAMPOS NECESARIOS ESTÉN PRESENTES
        const requiredFields = [ 'email'];
        const availableFields = requiredFields.filter(
          (field) => this.userData[field]
        );
        const missingFields = requiredFields.filter(
          (field) => !this.userData[field]
        );

        this.logger.log('✅ Campos disponibles:', availableFields);
        if (missingFields.length > 0) {
          this.logger.log('⚠️ Campos faltantes:', missingFields);
        }
      } catch (error) {
        this.logger.error('❌ Error al parsear datos del usuario:', error);
        this.userData = null;
      }
    } else {
      this.logger.log(
        'ℹ️ No hay datos del usuario guardados en sessionStorage para numerología'
      );
      this.userData = null;
    }

    const savedMessages = JSON.stringify(this.storage.getMessages('numerologyMessages'));
    const savedFirstQuestion = this.storage.isFirstQuestion('numerology') ? null : 'true';
    const savedBlockedMessageId = this.storage.getBlockedMessageId('numerology');

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
          '✅ Mensajes de numerología restaurados desde sessionStorage'
        );
      } catch (error) {
        this.logger.error('Error al restaurar mensajes:', error);
        this.clearSessionData();
        this.startConversation();
      }
    } else {
      this.startConversation();
    }

    // Verificar URL para pagos exitosos
    this.checkPaymentStatus();

    // Probar conexión
    this.numerologyService.testConnection().subscribe({
      next: (response) => {
        this.logger.log('✅ Conexión con numerología exitosa:', response);
      },
      error: (error) => {
        this.logger.error('❌ Error de conexión con numerología:', error);
      },
    });

    if (this.hasStartedConversation && FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(2000);
    }
  }

  onWheelClosed(): void {
    this.logger.log('🎰 Cerrando ruleta numerológica');
    this.showFortuneWheel = false;
  }
  triggerFortuneWheel(): void {
    this.logger.log('🎰 Intentando activar ruleta numerológica manualmente...');

    if (this.showPaymentModal || this.showDataModal) {
      this.logger.log('❌ No se puede mostrar - hay otros modales abiertos');
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.logger.log('✅ Activando ruleta numerológica manualmente');
      this.showFortuneWheel = true;
    } else {
      this.logger.log(
        '❌ No se puede activar ruleta numerológica - sin tiradas disponibles'
      );
      alert(
        'You dont have spins available. ' +
          FortuneWheelComponent.getSpinStatus()
      );
    }
  }
  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }
  private processNumerologyPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Lecturas Gratis
        this.addFreeNumerologyConsultations(3);
        break;
      case '2': // 1 Análisis Premium - ACCESO COMPLETO
        this.logger.log('✨ Premio Premium ganado - Acceso ilimitado concedido');
        this.hasUserPaidForNumerology = true;
        this.storage.setUserPaid('Numerology', true);

        // Desbloquear cualquier mensaje bloqueado
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          this.storage.removeBlockedMessageId('numerology');
          this.logger.log(
            '🔓 Mensaje desbloqueado con acceso premium numerológico'
          );
        }

        // Agregar mensaje especial para este premio
        const premiumMessage: ConversationMessage = {
          role: 'numerologist',
          message:
            '✨ **You have unlocked Premium Access!** ✨\n\nThe sacred numbers have conspired in your favor in extraordinary ways. You now have unlimited access to all the numerological wisdom. You can inquire about your life path, destiny numbers, numerical compatibilities, and all the mysteries of numerology as many times as you wish.\n\n🔢 *The numerical universe has revealed all its secrets to you* 🔢',
          timestamp: new Date(),
        };
        this.messages.push(premiumMessage);
        this.shouldAutoScroll = true;
        this.saveMessagesToSession();
        break;
      // ✅ ELIMINADO: case '3' - 2 Consultas Extra
      case '4': // Otra oportunidad
        this.logger.log('🔄 Otra oportunidad numerológica concedida');
        break;
      default:
        this.logger.warn('⚠️ Premio numerológico desconocido:', prize);
    }
  }
  private addFreeNumerologyConsultations(count: number): void {
    const current = parseInt(
      this.storage.getFreeConsultations('Numerology').toString() || '0'
    );
    const newTotal = current + count;
    this.storage.setFreeConsultations('Numerology', newTotal);
    this.logger.log(
      `🎁 Agregadas ${count} consultas numerológicas. Total: ${newTotal}`
    );

    // Si había un mensaje bloqueado, desbloquearlo
    if (this.blockedMessageId && !this.hasUserPaidForNumerology) {
      this.blockedMessageId = null;
      this.storage.removeBlockedMessageId('numerology');
      this.logger.log('🔓 Mensaje numerológico desbloqueado con consulta gratuita');
    }
  }

  private hasFreeNumerologyConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('Numerology').toString() || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeNumerologyConsultation(): void {
    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('Numerology').toString() || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      this.storage.setFreeConsultations('Numerology', remaining);
      this.logger.log(
        `🎁 Consulta numerológica gratis usada. Restantes: ${remaining}`
      );

      // Mostrar mensaje informativo
      const prizeMsg: ConversationMessage = {
        role: 'numerologist',
        message: `✨ *You have used a free numerology consultation* ✨\n\nYou have **${remaining}** free numerology consultations left.`,
        timestamp: new Date(),
      };
      this.messages.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
    }
  }
  private async checkPaymentStatus(): Promise<void> {
    // ✅ Verificar pago SOLO de este servicio específico
    this.hasUserPaidForNumerology =
      this.storage.hasUserPaid('Numerology');

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          // ✅ Pago SOLO para este servicio (Numerología)
          this.hasUserPaidForNumerology = true;
          this.storage.setUserPaid('Numerology', true);

          this.blockedMessageId = null;
          this.storage.removeBlockedMessageId('numerology');

          // Limpiar URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          // Cerrar el modal de pago si está abierto
          this.showPaymentModal = false;
          this.isProcessingPayment = false;
          this.paymentError = null;

          // ✅ MENSAJE VISIBLE DE PAGO EXITOSO CON RETRASO MAYOR
          setTimeout(() => {
            const confirmationMsg: ConversationMessage = {
              role: 'numerologist',
              message:
                '🎉 Payment completed successfully!\\n\\n' +
                '✨ Thank you for your payment. You now have full access to Numerology.\\n\\n' +
                '🔢 Let\'s discover the secrets of sacred numbers together!\\n\\n' +
                '📌 Note: This payment is only valid for the Numerology service. Other services require a separate payment.',
              timestamp: new Date(),
            };
            this.messages.push(confirmationMsg);
            this.shouldAutoScroll = true;
            this.saveMessagesToSession();

            // Procesar mensaje pendiente si existe
            const pendingMessage = this.storage.getSessionItem<string>('pendingNumerologyMessage');
            if (pendingMessage) {
              this.logger.log('📝 Procesando mensaje pendiente:', pendingMessage);
              this.storage.removeSessionItem('pendingNumerologyMessage');
              setTimeout(() => {
                this.currentMessage = pendingMessage;
                this.sendMessage();
              }, 1000);
            }
          }, 1000);
        } else {
          // Pago no válido
          this.paymentError = 'Payment could not be verified.';

          setTimeout(() => {
            const errorMsg: ConversationMessage = {
              role: 'numerologist',
              message:
                '⚠️ There was a problem verifying your payment. Please try again or contact our support.',
              timestamp: new Date(),
            };
            this.messages.push(errorMsg);
            this.saveMessagesToSession();
          }, 800);
        }
      } catch (error) {
        this.logger.error('Error verificando pago de PayPal:', error);
        this.paymentError = 'Error in payment verification';

        setTimeout(() => {
          const errorMsg: ConversationMessage = {
            role: 'numerologist',
            message:
              '❌ Unfortunately, there was an error verifying your payment. Please try again later.',
            timestamp: new Date(),
          };
          this.messages.push(errorMsg);
          this.saveMessagesToSession();
        }, 800);
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
    const threshold = 50;
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

      const welcomeMessage: ConversationMessage = {
        role: 'numerologist',
        message: randomWelcome,
        timestamp: new Date(),
      };

      this.messages.push(welcomeMessage);
    }
    this.hasStartedConversation = true;

    if (FortuneWheelComponent.canShowWheel()) {
      this.showWheelAfterDelay(3000);
    } else {
      this.logger.log(
        '🚫 No se puede mostrar ruleta numerológica - sin tiradas disponibles'
      );
    }
  }

  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) return;

    const userMessage = this.currentMessage.trim();

    // ✅ NUEVA LÓGICA: Verificar consultas numerológicas gratuitas ANTES de verificar pago
    if (!this.hasUserPaidForNumerology && this.firstQuestionAsked) {
      // Verificar si tiene consultas numerológicas gratis disponibles
      if (this.hasFreeNumerologyConsultationsAvailable()) {
        this.logger.log('🎁 Usando consulta numerológica gratis del premio');
        this.useFreeNumerologyConsultation();
        // Continuar con el mensaje sin bloquear
      } else {
        // Si no tiene consultas gratis, mostrar modal de datos
        this.logger.log(
          '💳 No hay consultas numerológicas gratis - mostrando modal de datos'
        );

        // Cerrar otros modales primero
        this.showFortuneWheel = false;
        this.showPaymentModal = false;

        // Guardar el mensaje para procesarlo después del pago
        this.storage.setSessionItem('pendingNumerologyMessage', userMessage);

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

    // Agregar mensaje del usuario
    const userMsg: ConversationMessage = {
      role: 'user',
      message: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isTyping = true;
    this.isLoading = true;

    // Preparar historial de conversación
    const conversationHistory = this.messages.slice(-10).map((msg) => ({
      role: msg.role === 'user' ? ('user' as const) : ('numerologist' as const),
      message: msg.message,
    }));

    // Enviar al servicio
    this.numerologyService
      .sendMessage(
        userMessage,
        this.birthDate || undefined,
        this.fullName || undefined,
        conversationHistory
      )
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.isTyping = false;

          if (response) {
            const messageId = Date.now().toString();

            const numerologistMsg: ConversationMessage = {
              role: 'numerologist',
              message: response,
              timestamp: new Date(),
              id: messageId,
            };
            this.messages.push(numerologistMsg);

            this.shouldAutoScroll = true;

            // ✅ LÓGICA MODIFICADA: Solo bloquear si no tiene consultas gratis Y no ha pagado
            if (
              this.firstQuestionAsked &&
              !this.hasUserPaidForNumerology &&
              !this.hasFreeNumerologyConsultationsAvailable()
            ) {
              this.blockedMessageId = messageId;
              this.storage.setBlockedMessageId('numerology', messageId);

              setTimeout(() => {
                this.logger.log(
                  '🔒 Mensaje numerológico bloqueado - mostrando modal de datos'
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
              this.storage.markFirstQuestionAsked('numerology');
            }

            this.saveMessagesToSession();
          } else {
            this.handleError('Error obtaining response from the numerologist');
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.isTyping = false;
          this.logger.error('Error:', error);
          this.handleError('Connection error. Please try again.');
        },
      });
  }
  private saveStateBeforePayment(): void {
    this.logger.log('💾 Guardando estado de numerología antes del pago...');
    this.saveMessagesToSession();
    this.storage.markFirstQuestionAsked('numerology');
    if (this.blockedMessageId) {
      this.storage.setBlockedMessageId('numerology', this.blockedMessageId);
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
      this.storage.setMessages('numerologyMessages', messagesToSave);
    } catch (error) {
      this.logger.error('Error guardando mensajes:', error);
    }
  }

  private clearSessionData(): void {
    this.storage.removeSessionItem('hasUserPaidForNumerology');
    this.storage.removeSessionItem('numerologyMessages');
    this.storage.removeSessionItem('numerologyFirstQuestionAsked');
    this.storage.removeBlockedMessageId('numerology');
    // ✅ NO ELIMINAR userData para mantener los datos entre sesiones
    // sessionStorage.removeItem('userData'); // Comentado para mantener los datos
  }

  isMessageBlocked(message: ConversationMessage): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForNumerology
    );
  }

  async promptForPayment(): Promise<void> {
    this.showPaymentModal = true;
    this.paymentError = null;
    this.isProcessingPayment = false;

    // Validar datos de usuario
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

    // Guardar mensaje pendiente si existe
    if (this.currentMessage) {
      this.storage.setSessionItem('pendingNumerologyMessage', this.currentMessage);
    }
  }

  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;

    try {
      const orderData = {
        amount: '7.00',
        currency: 'EUR',
        serviceName: 'Numerology Reading',
        returnPath: '/numerology',
        cancelPath: '/numerology',
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

  savePersonalData(): void {
    if (this.fullName) {
      this.personalNumbers.destiny =
        this.numerologyService.calculateDestinyNumber(this.fullName);
    }

    if (this.birthDate) {
      this.personalNumbers.lifePath = this.numerologyService.calculateLifePath(
        this.birthDate
      );
    }

    this.showDataForm = false;

    if (this.personalNumbers.lifePath || this.personalNumbers.destiny) {
      let numbersMessage = 'He calculado tus números sagrados:\n\n';

      if (this.personalNumbers.lifePath) {
        numbersMessage += `🔹 Camino de Vida: ${
          this.personalNumbers.lifePath
        } - ${this.numerologyService.getNumberMeaning(
          this.personalNumbers.lifePath
        )}\n\n`;
      }

      if (this.personalNumbers.destiny) {
        numbersMessage += `🔹 Número del Destino: ${
          this.personalNumbers.destiny
        } - ${this.numerologyService.getNumberMeaning(
          this.personalNumbers.destiny
        )}\n\n`;
      }

      numbersMessage +=
        '¿Te gustaría que profundice en la interpretación de alguno de estos números?';

      const numbersMsg: ConversationMessage = {
        role: 'numerologist',
        message: numbersMessage,
        timestamp: new Date(),
      };
      this.messages.push(numbersMsg);
      this.saveMessagesToSession();
    }
  }

  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  newConsultation(): void {
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    if (!this.hasUserPaidForNumerology) {
      this.firstQuestionAsked = false;
      this.blockedMessageId = null;
      this.clearSessionData();
    } else {
      this.storage.removeSessionItem('numerologyMessages');
      this.storage.removeSessionItem('numerologyFirstQuestionAsked');
      this.storage.removeBlockedMessageId('numerology');
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
      role: 'numerologist',
      message: `🔢 The cosmic numbers are fluctuating... ${errorMessage} Please try again when the numerical vibrations stabilize.`,
      timestamp: new Date(),
    };
    this.messages.push(errorMsg);
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

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  getTimeString(timestamp: Date | string): string {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
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

  closeModal(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }
  onUserDataSubmitted(userData: any): void {
    this.logger.log('📥 Datos del usuario recibidos en numerología:', userData);
    this.logger.log('📋 Campos disponibles:', Object.keys(userData));

    // ✅ VALIDAR CAMPOS CRÍTICOS ANTES DE PROCEDER
    const requiredFields = ['email'];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      this.logger.error(
        '❌ Faltan campos obligatorios para numerología:',
        missingFields
      );
      alert(
        `To proceed with payment, you need to complete: ${missingFields.join(
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
        '✅ Datos guardados en sessionStorage para numerología:',
        this.userData
      );

      // Verificar que se guardaron correctamente
      const verificacion = JSON.stringify(this.storage.getUserData());
      this.logger.log(
        '🔍 Verificación - Datos en sessionStorage para numerología:',
        verificacion ? JSON.parse(verificacion) : 'No encontrados'
      );
    } catch (error) {
      this.logger.error('❌ Error guardando en sessionStorage:', error);
    }

    this.showDataModal = false;

    // ✅ NUEVO: Enviar datos al backend como en el componente de sueños
    this.sendUserDataToBackend(userData);
  }

  // ✅ NUEVO: Agregar método para enviar al backend (como en el componente de sueños)
  private sendUserDataToBackend(userData: any): void {
    this.logger.log('📤 Enviando datos al backend desde numerología...');

    this.http.post(`${this.backendUrl}api/recolecta`, userData).subscribe({
      next: (response) => {
        this.logger.log(
          '✅ Datos enviados correctamente al backend desde numerología:',
          response
        );

        // ✅ PROCEDER AL PAGO DESPUÉS DE UN PEQUEÑO DELAY
        setTimeout(() => {
          this.promptForPayment();
        }, 500);
      },
      error: (error) => {
        this.logger.error(
          '❌ Error enviando datos al backend desde numerología:',
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
  onPrizeWon(prize: Prize): void {
    this.logger.log('🎉 Premio numerológico ganado:', prize);

    const prizeMessage: ConversationMessage = {
      role: 'numerologist',
      message: `🔢 Sacred numbers have blessed you! You have won: **${prize.name}** ${prize.icon}\n\nThe numerical vibrations of the universe have decided to favor you with this cosmic gift. The energy of ancient numbers flows through you, revealing deeper secrets of your numerological destiny. May the wisdom of numbers guide you!`,
      timestamp: new Date(),
    };

    this.messages.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();

    this.processNumerologyPrize(prize);
  }

  showWheelAfterDelay(delayMs: number = 3000): void {
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
      }
    }, delayMs);
  }
}
