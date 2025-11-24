import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  AnimalChatRequest,
  AnimalGuideData,
  AnimalInteriorService,
} from '../../services/animal-interior.service';
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
interface Message {
  role: 'user' | 'guide';
  content: string;
  timestamp: Date;
}

interface ChatMessage {
  sender: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  id?: string;
}
@Component({
  selector: 'app-animal-interior',
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
  templateUrl: './animal-interior.component.html',
  styleUrl: './animal-interior.component.css',
})
export class AnimalInteriorComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('chatContainer') chatContainer!: ElementRef;

  chatMessages: ChatMessage[] = [];
  currentMessage: string = '';
  isLoading: boolean = false;
  //Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;
  // Propiedades para controlar el scroll
  private shouldScrollToBottom: boolean = true;
  private isUserScrolling: boolean = false;
  private lastMessageCount: number = 0;

  // Datos del guía
  private guideData: AnimalGuideData = {
    name: 'Shaman Olivia',
    specialty: 'Inner Animal Guide',
    experience: 'Specialist in spiritual connection with the animal kingdom',
  };
  //Propiedades para la ruleta
  showFortuneWheel: boolean = false;
  animalPrizes: Prize[] = [
    {
      id: '1',
      name: '3 Animal Wheel Spins',
      color: '#4ecdc4',
      icon: '🦉',
    },
    { id: '2', name: '1 Premium Animal Guide', color: '#45b7d1', icon: '🦋' },
    {
      id: '4',
      name: 'Try Again!',
      color: '#ff7675',
      icon: '🌙',
    },
  ];
  private wheelTimer: any;
  // PayPal payment control
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaid: boolean = false;
  firstQuestionAsked: boolean = false;
  blockedMessageId: string | null = null;

  private backendUrl = environment.apiUrl;

  constructor(
    private animalService: AnimalInteriorService,
    private http: HttpClient,
    private logger: LoggerService,
    private storage: StorageService,
    private paypalService: PaypalService
  ) {}
  @ViewChild('backgroundVideo') backgroundVideo!: ElementRef<HTMLVideoElement>;

  ngAfterViewInit(): void {
    // Ajusta la velocidad del video de fondo (0.5 = la mitad de velocidad)
    if (this.backgroundVideo && this.backgroundVideo.nativeElement) {
      this.backgroundVideo.nativeElement.playbackRate = 0.6;
    }
  }

  async ngOnInit(): Promise<void> {
   
    const savedUserData = JSON.stringify(this.storage.getUserData());
    if (savedUserData) {
      try {
        this.userData = JSON.parse(savedUserData);
        this.logger.log(
          '✅ Datos del usuario restaurados para animal interior:',
          this.userData
        );
      } catch (error) {
        this.logger.error('❌ Error al parsear datos del usuario:', error);
        this.userData = null;
      }
    } else {
      this.logger.log(
        'ℹ️ No hay datos del usuario guardados en sessionStorage para animal interior'
      );
      this.userData = null;
    }

    const savedMessages = JSON.stringify(this.storage.getMessages('animalInteriorMessages'));
    const savedFirstQuestion = this.storage.isFirstQuestion('animalInterior') ? null : 'true';
    const savedBlockedMessageId = this.storage.getBlockedMessageId('animalinterior');

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.chatMessages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.firstQuestionAsked = savedFirstQuestion === 'true';
        this.blockedMessageId = savedBlockedMessageId || null;
        this.lastMessageCount = this.chatMessages.length;
      } catch (error) {
        this.logger.error('Error al restaurar mensajes de animal interior:', error);
        // Limpiar datos corruptos
        this.initializeWelcomeMessage();
      }
    }

    if (this.chatMessages.length === 0) {
      this.initializeWelcomeMessage();
    }

    this.checkPaymentStatus();

    // ✅ TAMBIÉN VERIFICAR PARA MENSAJES RESTAURADOS
    if (this.chatMessages.length > 0 && FortuneWheelComponent.canShowWheel()) {
      this.showAnimalWheelAfterDelay(2000);
    }
  }
  private initializeWelcomeMessage(): void {
    this.addMessage({
      sender: 'Shaman Olivia',
      content: `🦉 Greetings, seeker! I am Olivia, your spiritual guide from the animal kingdom. I am here to help you discover and connect with your inner animal.

What would you like to explore about your spirit animal?`,
      timestamp: new Date(),
      isUser: false,
    });

    if (FortuneWheelComponent.canShowWheel()) {
      this.showAnimalWheelAfterDelay(3000);
    } else {
      this.logger.log(
        '🚫 No se puede mostrar ruleta animal - sin tiradas disponibles'
      );
    }
  }
  ngAfterViewChecked(): void {
    // Solo hacer scroll automático si hay nuevos mensajes y el usuario no está haciendo scroll manual
    if (
      this.shouldScrollToBottom &&
      !this.isUserScrolling &&
      this.chatMessages.length > this.lastMessageCount
    ) {
      this.scrollToBottom();
      this.lastMessageCount = this.chatMessages.length;
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }

  private async checkPaymentStatus(): Promise<void> {
    this.hasUserPaid = this.storage.hasUserPaid('AnimalInterior');

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          this.hasUserPaid = true;
          this.storage.setUserPaid('AnimalInterior', true);

          this.blockedMessageId = null;
          this.storage.removeBlockedMessageId('animalInterior');

          window.history.replaceState({}, document.title, window.location.pathname);

          this.showPaymentModal = false;
          this.isProcessingPayment = false;
          this.paymentError = null;

          setTimeout(() => {
            const confirmationMsg: ChatMessage = {
              sender: 'Shaman Olivia',
              content:
                '🎉 Payment completed successfully!\n\n' +
                '✨ Thank you. You now have full access to Inner Animal Guide.\n\n' +
                '🦉 Let\'s explore the wisdom of your spirit animal together!',
              timestamp: new Date(),
              isUser: false,
            };
            this.addMessage(confirmationMsg);
            this.saveMessagesToSession();

            const pendingMessage = this.storage.getSessionItem<string>('pendingAnimalMessage');
            if (pendingMessage) {
              this.storage.removeSessionItem('pendingAnimalMessage');
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
  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) return;
    const userMessage = this.currentMessage.trim();

    // ✅ NUEVA LÓGICA: Verificar consultas animales gratuitas ANTES de verificar pago
    if (!this.hasUserPaid && this.firstQuestionAsked) {
      // Verificar si tiene consultas animales gratis disponibles
      if (this.hasFreeAnimalConsultationsAvailable()) {
        this.logger.log('🎁 Usando consulta animal gratis del premio');
        this.useFreeAnimalConsultation();
        // Continuar con el mensaje sin bloquear
      } else {
        // Si no tiene consultas gratis, mostrar modal de datos
        this.logger.log(
          '💳 No hay consultas animales gratis - mostrando modal de datos'
        );

        // Cerrar otros modales primero
        this.showFortuneWheel = false;
        this.showPaymentModal = false;

        // Guardar el mensaje para procesarlo después del pago
        this.storage.setSessionItem('pendingAnimalMessage', userMessage);

        this.saveStateBeforePayment();

        // Mostrar modal de datos con timeout
        setTimeout(() => {
          this.showDataModal = true;
          this.logger.log('📝 showDataModal establecido a:', this.showDataModal);
        }, 100);

        return; // Salir aquí para no procesar el mensaje aún
      }
    }

    this.shouldScrollToBottom = true;

    // Procesar mensaje normalmente
    this.processUserMessage(userMessage);
  }
  private processUserMessage(userMessage: string): void {
    this.addMessage({
      sender: 'Tú',
      content: userMessage,
      timestamp: new Date(),
      isUser: true,
    });

    this.currentMessage = '';
    this.isLoading = true;

    // Preparar conversationHistory para tu servicio
    const conversationHistory = this.chatMessages.slice(-10).map((msg) => ({
      role: msg.isUser ? ('user' as const) : ('guide' as const),
      message: msg.content,
    }));

    // Preparar el request según tu interfaz
    const chatRequest: AnimalChatRequest = {
      guideData: this.guideData,
      userMessage: userMessage,
      conversationHistory: conversationHistory,
    };

    this.animalService.chatWithGuide(chatRequest).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.shouldScrollToBottom = true;

        if (response.success && response.response) {
          const messageId = Date.now().toString();
          this.addMessage({
            sender: 'Shaman Olivia',
            content: response.response,
            timestamp: new Date(),
            isUser: false,
            id: messageId,
          });

          // ✅ LÓGICA MODIFICADA: Solo bloquear si no tiene consultas gratis Y no ha pagado
          if (
            this.firstQuestionAsked &&
            !this.hasUserPaid &&
            !this.hasFreeAnimalConsultationsAvailable()
          ) {
            this.blockedMessageId = messageId;
            this.storage.setBlockedMessageId('animalInterior', messageId);
            setTimeout(() => {
              this.logger.log(
                '🔒 Mensaje animal bloqueado - mostrando modal de datos'
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
            this.storage.markFirstQuestionAsked('animalInterior');
          }
        } else {
          this.addMessage({
            sender: 'Shaman Olivia',
            content:
              "🦉 So sorry, I couldn't connect with the animal wisdom at this moment. Please try again.",
            timestamp: new Date(),
            isUser: false,
          });
        }
        this.saveMessagesToSession();
      },
      error: (error) => {
        this.isLoading = false;
        this.shouldScrollToBottom = true;
        this.addMessage({
          sender: 'Shaman Olivia',
          content:
            '🦉 An error occurred in the spiritual connection. Please try again.',
          timestamp: new Date(),
          isUser: false,
        });
        this.saveMessagesToSession();
      },
    });
  }
  private saveStateBeforePayment(): void {
    this.saveMessagesToSession();
    this.storage.markFirstQuestionAsked('animalinterior');
    if (this.blockedMessageId) {
      this.storage.setBlockedMessageId('animalinterior', this.blockedMessageId);
    }
  }

  private saveMessagesToSession(): void {
    try {
      const messagesToSave = this.chatMessages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      this.storage.setMessages('animalInteriorMessages', messagesToSave);
    } catch {}
  }

  isMessageBlocked(message: ChatMessage): boolean {
    return message.id === this.blockedMessageId && !this.hasUserPaid;
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

    if (this.currentMessage) {
      this.storage.setSessionItem('pendingAnimalMessage', this.currentMessage);
    }
  }

  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;

    try {
      const orderData = {
        amount: '7.00',
        currency: 'USD',
        serviceName: 'Inner Animal Guide',
        returnPath: '/inner-animal',
        cancelPath: '/inner-animal',
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

  addMessage(message: ChatMessage): void {
    this.chatMessages.push(message);
    this.shouldScrollToBottom = true;
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

  getTimeString(timestamp: Date | string): string {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  }

  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onScroll(event: any): void {
    const element = event.target;
    const isAtBottom =
      element.scrollHeight - element.scrollTop === element.clientHeight;

    // Si el usuario no está en el fondo, está haciendo scroll manual
    this.isUserScrolling = !isAtBottom;

    // Si el usuario vuelve al fondo, permitir scroll automático nuevamente
    if (isAtBottom) {
      this.isUserScrolling = false;
    }
  }

  onUserStartScroll(): void {
    // Indicar que el usuario está haciendo scroll manual
    this.isUserScrolling = true;

    // Después de 3 segundos sin actividad, permitir scroll automático nuevamente
    setTimeout(() => {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        const isAtBottom =
          element.scrollHeight - element.scrollTop === element.clientHeight;
        if (isAtBottom) {
          this.isUserScrolling = false;
        }
      }
    }, 3000);
  }

  private scrollToBottom(): void {
    try {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch {}
  }

  clearChat(): void {
    // Limpiar mensajes del chat
    this.chatMessages = [];
    this.currentMessage = '';
    this.lastMessageCount = 0;

    // Resetear estados
    this.firstQuestionAsked = false;
    this.blockedMessageId = null;
    this.isLoading = false;

    // Limpiar sessionStorage
    this.storage.removeSessionItem('animalInteriorMessages');
    this.storage.removeSessionItem('animalInteriorFirstQuestionAsked');
    this.storage.removeBlockedMessageId('animalInterior');

    // Indicar que se debe hacer scroll porque hay un mensaje nuevo
    this.shouldScrollToBottom = true;

    // Agregar mensaje de bienvenida inicial
    this.addMessage({
      sender: 'Shaman Olivia',
      content: `🦉 Greetings, seeker! I am Olivia, your spiritual guide from the animal kingdom. I am here to help you discover and connect with your inner animal.

What would you like to explore about your spirit animal?`,
      timestamp: new Date(),
      isUser: false,
    });
    if (FortuneWheelComponent.canShowWheel()) {
      this.showAnimalWheelAfterDelay(3000);
    } else {
      this.logger.log(
        '🚫 No se puede mostrar ruleta animal - sin tiradas disponibles'
      );
    }
  }
  onUserDataSubmitted(userData: any): void {
    this.logger.log('📥 Datos del usuario recibidos en animal interior:', userData);
    this.logger.log('📋 Campos disponibles:', Object.keys(userData));

    // ✅ VALIDAR CAMPOS CRÍTICOS ANTES DE PROCEDER
    const requiredFields = [ 'email'];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      this.logger.error(
        '❌ Faltan campos obligatorios para animal interior:',
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
        '✅ Datos guardados en sessionStorage para animal interior:',
        this.userData
      );

      // Verificar que se guardaron correctamente
      const verificacion = JSON.stringify(this.storage.getUserData());
      this.logger.log(
        '🔍 Verificación - Datos en sessionStorage para animal interior:',
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
    this.logger.log('📤 Enviando datos al backend desde animal interior...');

    this.http.post(`${this.backendUrl}api/recolecta`, userData).subscribe({
      next: (response) => {
        this.logger.log(
          '✅ Datos enviados correctamente al backend desde animal interior:',
          response
        );

        // ✅ PROCEDER AL PAGO DESPUÉS DE UN PEQUEÑO DELAY
        setTimeout(() => {
          this.promptForPayment();
        }, 500);
      },
      error: (error) => {
        this.logger.error(
          '❌ Error enviando datos al backend desde animal interior:',
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
  showAnimalWheelAfterDelay(delayMs: number = 3000): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    this.logger.log('⏰ Timer animal espiritual configurado para', delayMs, 'ms');

    this.wheelTimer = setTimeout(() => {
      this.logger.log('🎰 Verificando si puede mostrar ruleta animal...');

      if (
        FortuneWheelComponent.canShowWheel() &&
        !this.showPaymentModal &&
        !this.showDataModal
      ) {
        this.logger.log('✅ Mostrando ruleta animal - usuario puede girar');
        this.showFortuneWheel = true;
      } else {
        this.logger.log('❌ No se puede mostrar ruleta animal en este momento');
      }
    }, delayMs);
  }

  onPrizeWon(prize: Prize): void {
    this.logger.log('🎉 Premio espiritual animal ganado:', prize);

    const prizeMessage: ChatMessage = {
      sender: 'Shaman Olivia',
      content: `🦉 Animal Spirits! You have won: **${prize.name}** ${prize.icon}\n\nThe ancient guardians of the animal kingdom have chosen to bless you with this sacred gift. Spiritual energy flows through you, connecting you more deeply with your inner animal. May ancestral wisdom guide you!`,
      timestamp: new Date(),
      isUser: false,
    };

    this.chatMessages.push(prizeMessage);
    this.shouldScrollToBottom = true;
    this.saveMessagesToSession();

    this.processAnimalPrize(prize);
  }

  onWheelClosed(): void {
    this.logger.log('🎰 Cerrando ruleta animal espiritual');
    this.showFortuneWheel = false;
  }

  triggerAnimalWheel(): void {
    this.logger.log('🎰 Intentando activar ruleta animal manualmente...');

    if (this.showPaymentModal || this.showDataModal) {
      this.logger.log('❌ No se puede mostrar - hay otros modales abiertos');
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.logger.log('✅ Activando ruleta animal manualmente');
      this.showFortuneWheel = true;
    } else {
      this.logger.log(
        '❌ No se puede activar ruleta animal - sin tiradas disponibles'
      );
      alert('N. ' + FortuneWheelComponent.getSpinStatus());
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }

  private processAnimalPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Conexiones Espirituales
        this.addFreeAnimalConsultations(3);
        break;
      case '2': // 1 Guía Premium - ACCESO COMPLETO
        this.logger.log('🦋 Premio Premium ganado - Acceso ilimitado concedido');
        this.hasUserPaid = true;
        this.storage.setUserPaid('AnimalInterior', true);

        // Desbloquear cualquier mensaje bloqueado
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          this.storage.removeBlockedMessageId('animalInterior');
          this.logger.log('🔓 Mensaje desbloqueado con acceso premium animal');
        }

        // Agregar mensaje especial para este premio
        const premiumMessage: ChatMessage = {
          sender: 'Shaman Olivia',
          content:
            '🦋 **You have unlocked Premium Access!** 🦋\n\nThe animal spirits have smiled upon you in extraordinary ways. You now have unlimited access to all the wisdom of the animal kingdom. You can consult about your inner animal, spiritual connections, and all ancestral mysteries as many times as you wish.\n\n✨ *The guardians of the animal kingdom have opened all their doors for you* ✨',
          timestamp: new Date(),
          isUser: false,
        };
        this.chatMessages.push(premiumMessage);
        this.shouldScrollToBottom = true;
        this.saveMessagesToSession();
        break;
      // ✅ ELIMINADO: case '3' - 2 Consultas Extra
      case '4': // Otra oportunidad
        this.logger.log('🔄 Otra oportunidad espiritual concedida');
        break;
      default:
        this.logger.warn('⚠️ Premio animal desconocido:', prize);
    }
  }
  private addFreeAnimalConsultations(count: number): void {
    const current = parseInt(
      this.storage.getFreeConsultations('Animal').toString() || '0'
    );
    const newTotal = current + count;
    this.storage.setFreeConsultations('Animal', newTotal);
    this.logger.log(`🎁 Agregadas ${count} consultas animales. Total: ${newTotal}`);

    if (this.blockedMessageId && !this.hasUserPaid) {
      this.blockedMessageId = null;
      this.storage.removeBlockedMessageId('animalInterior');
      this.logger.log('🔓 Mensaje animal desbloqueado con consulta gratuita');
    }
  }

  private hasFreeAnimalConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('Animal').toString() || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeAnimalConsultation(): void {
    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('Animal').toString() || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      this.storage.setFreeConsultations('Animal', remaining);
      this.logger.log(`🎁 Consulta animal gratis usada. Restantes: ${remaining}`);

      const prizeMsg: ChatMessage = {
        sender: 'Shaman Olivia',
        content: `✨ *You have used a free spiritual connection* ✨\n\nYou have **${remaining}** consultations with the animal kingdom available.`,
        timestamp: new Date(),
        isUser: false,
      };
      this.chatMessages.push(prizeMsg);
      this.shouldScrollToBottom = true;
      this.saveMessagesToSession();
    }
  }

  debugAnimalWheel(): void {
    this.logger.log('=== DEBUG RULETA ANIMAL ===');
    this.logger.log('showFortuneWheel:', this.showFortuneWheel);
    this.logger.log(
      'FortuneWheelComponent.canShowWheel():',
      FortuneWheelComponent.canShowWheel()
    );
    this.logger.log('showPaymentModal:', this.showPaymentModal);
    this.logger.log('showDataModal:', this.showDataModal);
    this.logger.log(
      'freeAnimalConsultations:',
      this.storage.getFreeConsultations('Animal').toString()
    );

    this.showFortuneWheel = true;
    this.logger.log('Forzado showFortuneWheel a:', this.showFortuneWheel);
  }
}
