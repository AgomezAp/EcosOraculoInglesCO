import { CommonModule } from '@angular/common';
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
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  BirthChartRequest,
  BirthChartResponse,
  TablaNacimientoService,
} from '../../services/tabla-nacimiento.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RecolectaDatosComponent } from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environments';
import { Observable, map, catchError, of } from 'rxjs';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';
import { LoggerService } from '../../services/logger.service';
import { StorageService } from '../../services/storage.service';
import { PaypalService } from '../../services/paypal.service';
interface BirthChartMessage {
  content: string;
  isUser: boolean;
  timestamp: Date;
  sender: string;
}

interface Message {
  sender: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  id?: string;
}
interface ChartData {
  sunSign?: string;
  moonSign?: string;
  ascendant?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  fullName?: string;
}

interface AstrologerInfo {
  name: string;
  title: string;
  specialty: string;
}
@Component({
  selector: 'app-tabla-nacimiento',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
    FortuneWheelComponent,
  ],
  templateUrl: './tabla-nacimiento.component.html',
  styleUrl: './tabla-nacimiento.component.css',
})
export class TablaNacimientoComponent
  implements OnInit, AfterViewChecked, OnDestroy, AfterViewInit
{
  @ViewChild('chatContainer') chatContainer!: ElementRef;

  // Chat y mensajes
  messages: Message[] = [];
  currentMessage: string = '';
  isLoading: boolean = false;

  // Control de scroll
  private shouldScrollToBottom: boolean = true;
  private isUserScrolling: boolean = false;
  private lastMessageCount: number = 0;

  // Datos personales y carta
  chartData: ChartData = {};
  fullName: string = '';
  birthDate: string = '';
  birthTime: string = '';
  birthPlace: string = '';
  showDataForm: boolean = false;

  // Información del astrólogo
  astrologerInfo: AstrologerInfo = {
    name: 'High Priestess Emma',
    title: 'Guardian of Celestial Configurations',
    specialty: 'Specialist in natal charts and transpersonal astrology',
  };
  //Datos para enviar
  showDataModal: boolean = false;
  userData: any = null;
  //Variables para la ruleta
  showFortuneWheel: boolean = false;
  birthChartPrizes: Prize[] = [
    {
      id: '1',
      name: '3 natal chart spins',
      color: '#4ecdc4',
      icon: '🌟',
    },
    {
      id: '2',
      name: '1 Premium Natal Analysis',
      color: '#45b7d1',
      icon: '✨',
    },
    {
      id: '4',
      name: 'Try Again!',
      color: '#ff7675',
      icon: '🔮',
    },
  ];
  private wheelTimer: any;
  // PayPal payment system
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaid: boolean = false;
  firstQuestionAsked: boolean = false;
  blockedMessageId: string | null = null;
  private backendUrl = environment.apiUrl;

  constructor(
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
    @Optional() public dialogRef: MatDialogRef<TablaNacimientoComponent>,
    private http: HttpClient,
    private tablaNacimientoService: TablaNacimientoService,
    private elRef: ElementRef<HTMLElement>,
    private logger: LoggerService,
    private storage: StorageService,
    private paypalService: PaypalService
  ) {}
  ngAfterViewInit(): void {
    this.setVideosSpeed(0.6); // 0.5 = más lento, 1 = normal
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
  

    // AGREGADO - Verificar estado de pago
    this.hasUserPaid =
      this.storage.hasUserPaid('BirthChart');

    // ✅ NUEVO: Cargar datos del usuario desde sessionStorage
    this.logger.log(
      '🔍 Cargando datos del usuario desde sessionStorage para tabla de nacimiento...'
    );
    const savedUserData = JSON.stringify(this.storage.getUserData());
    if (savedUserData) {
      try {
        this.userData = JSON.parse(savedUserData);
        this.logger.log(
          '✅ Datos del usuario restaurados para tabla de nacimiento:',
          this.userData
        );
      } catch (error) {
        this.logger.error('❌ Error al parsear datos del usuario:', error);
        this.userData = null;
      }
    } else {
      this.logger.log(
        'ℹ️ No hay datos del usuario guardados en sessionStorage para tabla de nacimiento'
      );
      this.userData = null;
    }

    // Cargar datos guardados
    this.loadSavedData();
    this.checkPaymentStatus();

    // Mensaje de bienvenida
    if (this.messages.length === 0) {
      this.initializeBirthChartWelcomeMessage();
    }

    // ✅ TAMBIÉN VERIFICAR PARA MENSAJES RESTAURADOS
    if (this.messages.length > 0 && FortuneWheelComponent.canShowWheel()) {
      this.showBirthChartWheelAfterDelay(2000);
    }
  }
  private initializeBirthChartWelcomeMessage(): void {
    this.addMessage({
      sender: 'High Priestess Emma',
      content: `🌟 Greetings, seeker of celestial mysteries! I am Emma, your guide through the cosmos of astral configurations. 

I am here to help you decipher the hidden secrets in your birth chart. The stars have been waiting for this moment to reveal their wisdom to you.

What aspect of your natal chart would you like to explore first?`,
      timestamp: new Date(),
      isUser: false,
    });

    // ✅ VERIFICACIÓN DE RULETA NATAL
    if (FortuneWheelComponent.canShowWheel()) {
      this.showBirthChartWheelAfterDelay(3000);
    } else {
      this.logger.log(
        '🚫 No se puede mostrar ruleta natal - sin tiradas disponibles'
      );
    }
  }
  ngAfterViewChecked(): void {
    if (
      this.shouldScrollToBottom &&
      !this.isUserScrolling &&
      this.messages.length > this.lastMessageCount
    ) {
      this.scrollToBottom();
      this.lastMessageCount = this.messages.length;
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
  }

  private loadSavedData(): void {
    const savedMessages = JSON.stringify(this.storage.getMessages('birthChartMessages'));
    const savedFirstQuestion = this.storage.isFirstQuestion('birthChart') ? null : 'true';
    const savedBlockedMessageId = this.storage.getBlockedMessageId('birthchart');
    const savedChartData = JSON.stringify(this.storage.getSessionItem('birthChartData'));

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.messages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.firstQuestionAsked = savedFirstQuestion === 'true';
        this.blockedMessageId = savedBlockedMessageId || null;
        this.lastMessageCount = this.messages.length;
      } catch (error) {
        this.logger.error(
          'Error al restaurar mensajes de tabla de nacimiento:',
          error
        );
        // Limpiar datos corruptos
        this.initializeBirthChartWelcomeMessage();
      }
    }

    if (savedChartData) {
      try {
        this.chartData = JSON.parse(savedChartData);
        this.fullName = this.chartData.fullName || '';
        this.birthDate = this.chartData.birthDate || '';
        this.birthTime = this.chartData.birthTime || '';
        this.birthPlace = this.chartData.birthPlace || '';
      } catch (error) {
        this.logger.error('Error al restaurar datos de carta natal:', error);
      }
    }
  }

  private async checkPaymentStatus(): Promise<void> {
    this.hasUserPaid = this.storage.hasUserPaid('BirthChart');

    const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

    if (paymentStatus && paymentStatus.status === 'COMPLETED') {
      try {
        const verification = await this.paypalService.verifyAndProcessPayment(
          paymentStatus.token
        );

        if (verification.valid && verification.status === 'approved') {
          this.hasUserPaid = true;
          this.storage.setUserPaid('BirthChart', true);

          this.blockedMessageId = null;
          this.storage.removeBlockedMessageId('birthChart');

          window.history.replaceState({}, document.title, window.location.pathname);

          this.showPaymentModal = false;
          this.isProcessingPayment = false;
          this.paymentError = null;

          setTimeout(() => {
            const confirmationMsg: BirthChartMessage = {
              sender: 'High Priestess Emma',
              content:
                '� Payment completed successfully!\n\n' +
                '✨ Thank you. You now have full access to Birth Chart Reading.\n\n' +
                '🌟 Let\'s explore the mysteries of your natal chart together!',
              timestamp: new Date(),
              isUser: false,
            };
            this.addMessage(confirmationMsg);
            this.saveMessagesToSession();

            const pendingMessage = this.storage.getSessionItem<string>('pendingBirthChartMessage');
            if (pendingMessage) {
              this.storage.removeSessionItem('pendingBirthChartMessage');
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
    if (this.currentMessage?.trim() && !this.isLoading) {
      const userMessage = this.currentMessage.trim();

      // ✅ NUEVA LÓGICA: Verificar consultas natales gratuitas ANTES de verificar pago
      if (!this.hasUserPaid && this.firstQuestionAsked) {
        // Verificar si tiene consultas natales gratis disponibles
        if (this.hasFreeBirthChartConsultationsAvailable()) {
          this.logger.log('🎁 Usando consulta natal gratis del premio');
          this.useFreeBirthChartConsultation();
          // Continuar con el mensaje sin bloquear
        } else {
          // Si no tiene consultas gratis, mostrar modal de datos
          this.logger.log(
            '💳 No hay consultas natales gratis - mostrando modal de datos'
          );

          // Cerrar otros modales primero
          this.showFortuneWheel = false;
          this.showPaymentModal = false;

          // Guardar el mensaje para procesarlo después del pago
          this.storage.setSessionItem('pendingBirthChartMessage', userMessage);

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
      this.processBirthChartUserMessage(userMessage);
    }
  }
  private processBirthChartUserMessage(userMessage: string): void {
    // Agregar mensaje del usuario
    const userMsg = {
      sender: 'Tú',
      content: userMessage,
      timestamp: new Date(),
      isUser: true,
    };
    this.messages.push(userMsg);

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isLoading = true;

    // Usar el servicio real de carta natal
    this.generateAstrologicalResponse(userMessage).subscribe({
      next: (response: any) => {
        this.isLoading = false;

        const messageId = Date.now().toString();
        const astrologerMsg = {
          sender: 'Maestra Emma',
          content: response,
          timestamp: new Date(),
          isUser: false,
          id: messageId,
        };
        this.messages.push(astrologerMsg);

        this.shouldScrollToBottom = true;

        // ✅ LÓGICA MODIFICADA: Solo bloquear si no tiene consultas gratis Y no ha pagado
        if (
          this.firstQuestionAsked &&
          !this.hasUserPaid &&
          !this.hasFreeBirthChartConsultationsAvailable()
        ) {
          this.blockedMessageId = messageId;
          this.storage.setBlockedMessageId('birthChart', messageId);

          setTimeout(() => {
            this.logger.log(
              '🔒 Mensaje natal bloqueado - mostrando modal de datos'
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
          this.storage.markFirstQuestionAsked('birthChart');
        }

        this.saveMessagesToSession();
      },
      error: (error: any) => {
        this.isLoading = false;
        this.logger.error('Error al obtener respuesta de carta natal:', error);

        const errorMsg = {
          sender: 'High Priestess Emma',
          content:
            "🌟 We're sorry, the celestial configurations are temporarily disturbed. Please try again in a few moments.",
          timestamp: new Date(),
          isUser: false,
        };
        this.messages.push(errorMsg);
        this.saveMessagesToSession();
      },
    });
  }
  private generateAstrologicalResponse(
    userMessage: string
  ): Observable<string> {
    // Crear el historial de conversación para el contexto
    const conversationHistory = this.messages
      .filter((msg) => msg.content && msg.content.trim() !== '')
      .map((msg) => ({
        role: msg.isUser ? ('user' as const) : ('astrologer' as const),
        message: msg.content,
      }));

    // Crear la solicitud con la estructura correcta
    const request: BirthChartRequest = {
      chartData: {
        name: this.astrologerInfo.name,
        specialty: this.astrologerInfo.specialty,
        experience:
          'Centuries of experience interpreting celestial configurations and the mysteries of natal charts',
      },
      userMessage,
      birthDate: this.birthDate,
      birthTime: this.birthTime,
      birthPlace: this.birthPlace,
      fullName: this.fullName,
      conversationHistory,
    };

    // Llamar al servicio y transformar la respuesta
    return this.tablaNacimientoService.chatWithAstrologer(request).pipe(
      map((response: BirthChartResponse) => {
        if (response.success && response.response) {
          return response.response;
        } else {
          throw new Error(response.error || 'Error desconocido del servicio');
        }
      }),
      catchError((error: any) => {
        this.logger.error('Error en el servicio de carta natal:', error);
        return of(
          "🌟 We're sorry, the celestial configurations are temporarily disturbed. Please try again in a few moments."
        );
      })
    );
  }

  private saveStateBeforePayment(): void {
    this.saveMessagesToSession();
    this.saveChartData();
    this.storage.markFirstQuestionAsked('birthchart');
    if (this.blockedMessageId) {
      this.storage.setBlockedMessageId('birthchart', this.blockedMessageId);
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
      this.storage.setMessages('birthChartMessages', messagesToSave);
    } catch {}
  }

  private saveChartData(): void {
    try {
      const dataToSave = {
        ...this.chartData,
        fullName: this.fullName,
        birthDate: this.birthDate,
        birthTime: this.birthTime,
        birthPlace: this.birthPlace,
      };
      this.storage.setSessionItem('birthChartData', dataToSave);
    } catch {}
  }

  isMessageBlocked(message: Message): boolean {
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
      this.storage.setSessionItem('pendingBirthChartMessage', this.currentMessage);
    }
  }

  async handlePaymentSubmit(): Promise<void> {
    this.isProcessingPayment = true;
    this.paymentError = null;

    try {
      const orderData = {
        amount: '7.00',
        currency: 'USD',
        serviceName: 'Birth Chart Reading',
        returnPath: '/birth-chart',
        cancelPath: '/birth-chart',
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

  // Métodos de manejo de datos personales
  savePersonalData(): void {
    this.chartData = {
      ...this.chartData,
      fullName: this.fullName,
      birthDate: this.birthDate,
      birthTime: this.birthTime,
      birthPlace: this.birthPlace,
    };

    // Generar signos de ejemplo basados en los datos
    if (this.birthDate) {
      this.generateSampleChartData();
    }

    this.saveChartData();
    this.showDataForm = false;

    this.shouldScrollToBottom = true;
    this.addMessage({
      sender: 'High Priestess Emma',
      content: `🌟 Perfect, ${this.fullName}. I have recorded your celestial data. The configurations of your birth in ${this.birthPlace} on ${this.birthDate} reveal unique patterns in the cosmos. What specific aspect of your natal chart would you like me to delve into?`,
      timestamp: new Date(),
      isUser: false,
    });
  }

  private generateSampleChartData(): void {
    // Generar datos de ejemplo basados en la fecha de nacimiento
    const date = new Date(this.birthDate);
    const month = date.getMonth() + 1;

    const zodiacSigns = [
      'Capricornio',
      'Acuario',
      'Piscis',
      'Aries',
      'Tauro',
      'Géminis',
      'Cáncer',
      'Leo',
      'Virgo',
      'Libra',
      'Escorpio',
      'Sagitario',
    ];

    const signIndex = Math.floor((month - 1) / 1) % 12;
    this.chartData.sunSign = zodiacSigns[signIndex];
    this.chartData.moonSign = zodiacSigns[(signIndex + 4) % 12];
    this.chartData.ascendant = zodiacSigns[(signIndex + 8) % 12];
  }

  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  // Métodos de utilidad
  addMessage(message: Message): void {
    this.messages.push(message);
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

  onScroll(event: any): void {
    const element = event.target;
    const isAtBottom =
      element.scrollHeight - element.scrollTop === element.clientHeight;
    this.isUserScrolling = !isAtBottom;
    if (isAtBottom) this.isUserScrolling = false;
  }

  onUserStartScroll(): void {
    this.isUserScrolling = true;
    setTimeout(() => {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        const isAtBottom =
          element.scrollHeight - element.scrollTop === element.clientHeight;
        if (isAtBottom) this.isUserScrolling = false;
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
  closeModal(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }
  clearChat(): void {
    // Limpiar mensajes del chat
    this.messages = [];
    this.currentMessage = '';
    this.lastMessageCount = 0;

    // Resetear estados
    this.firstQuestionAsked = false;
    this.blockedMessageId = null;
    this.isLoading = false;

    // Limpiar sessionStorage de tabla de nacimiento (pero NO userData)
    this.storage.removeSessionItem('birthChartMessages');
    this.storage.removeSessionItem('birthChartFirstQuestionAsked');
    this.storage.removeBlockedMessageId('birthChart');
    this.storage.removeSessionItem('birthChartData');

    // Indicar que se debe hacer scroll porque hay un mensaje nuevo
    this.shouldScrollToBottom = true;

    // Usar el método separado para inicializar
    this.initializeBirthChartWelcomeMessage();
  }
  onUserDataSubmitted(userData: any): void {
    this.logger.log(
      '📥 Datos del usuario recibidos en tabla de nacimiento:',
      userData
    );
    this.logger.log('📋 Campos disponibles:', Object.keys(userData));

    // ✅ VALIDAR CAMPOS CRÍTICOS ANTES DE PROCEDER
    const requiredFields = ['email'];
    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      this.logger.error(
        '❌ Missing required fields for birth chart:',
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
        '✅ Datos guardados en sessionStorage para tabla de nacimiento:',
        this.userData
      );

      // Verificar que se guardaron correctamente
      const verificacion = JSON.stringify(this.storage.getUserData());
      this.logger.log(
        '🔍 Verificación - Datos en sessionStorage para tabla de nacimiento:',
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
    this.logger.log('📤 Enviando datos al backend desde tabla de nacimiento...');

    this.http.post(`${this.backendUrl}api/recolecta`, userData).subscribe({
      next: (response) => {
        this.logger.log(
          '✅ Datos enviados correctamente al backend desde tabla de nacimiento:',
          response
        );

        // ✅ PROCEDER AL PAGO DESPUÉS DE UN PEQUEÑO DELAY
        setTimeout(() => {
          this.promptForPayment();
        }, 500);
      },
      error: (error) => {
        this.logger.error(
          '❌ Error enviando datos al backend desde tabla de nacimiento:',
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
  showBirthChartWheelAfterDelay(delayMs: number = 3000): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    this.logger.log('⏰ Timer carta natal configurado para', delayMs, 'ms');

    this.wheelTimer = setTimeout(() => {
      this.logger.log('🎰 Verificando si puede mostrar ruleta natal...');

      if (
        FortuneWheelComponent.canShowWheel() &&
        !this.showPaymentModal &&
        !this.showDataModal
      ) {
        this.logger.log('✅ Mostrando ruleta natal - usuario puede girar');
        this.showFortuneWheel = true;
      } else {
        this.logger.log('❌ No se puede mostrar ruleta natal en este momento');
      }
    }, delayMs);
  }

  onPrizeWon(prize: Prize): void {
    this.logger.log('🎉 Premio celestial ganado:', prize);

    const prizeMessage: Message = {
      sender: 'High Priestess Emma',
      content: `🌟 The celestial configurations have conspired in your favor! You have won: **${prize.name}** ${prize.icon}\n\nThe ancient guardians of the stars have decided to bless you with this sacred gift. The cosmic energy flows through you, revealing deeper secrets of your natal chart. May celestial wisdom illuminate your path!`,
      timestamp: new Date(),
      isUser: false,
    };

    this.messages.push(prizeMessage);
    this.shouldScrollToBottom = true;
    this.saveMessagesToSession();

    this.processBirthChartPrize(prize);
  }

  onWheelClosed(): void {
    this.logger.log('🎰 Cerrando ruleta de carta natal');
    this.showFortuneWheel = false;
  }

  triggerBirthChartWheel(): void {
    this.logger.log('🎰 Intentando activar ruleta natal manualmente...');

    if (this.showPaymentModal || this.showDataModal) {
      this.logger.log('❌ No se puede mostrar - hay otros modales abiertos');
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.logger.log('✅ Activando ruleta natal manualmente');
      this.showFortuneWheel = true;
    } else {
      this.logger.log(
        '❌ No se puede activar ruleta natal - sin tiradas disponibles'
      );
      alert(
        'You have no spins available. ' + FortuneWheelComponent.getSpinStatus()
      );
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }
  private processBirthChartPrize(prize: Prize): void {
    switch (prize.id) {
      case '1': // 3 Lecturas Astrales
        this.addFreeBirthChartConsultations(3);
        break;
      case '2': // 1 Análisis Premium - ACCESO COMPLETO
        this.logger.log('🌟 Premio Premium ganado - Acceso ilimitado concedido');
        this.hasUserPaid = true;
        this.storage.setUserPaid('BirthChart', true);

        // Desbloquear cualquier mensaje bloqueado
        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          this.storage.removeBlockedMessageId('birthChart');
          this.logger.log('🔓 Mensaje desbloqueado con acceso premium');
        }

        // Agregar mensaje especial para este premio
        const premiumMessage: Message = {
          sender: 'High Priestess Emma',
          content:
            '🌟 **You have unlocked Premium Access!** 🌟\n\nThe celestial configurations have smiled upon you in extraordinary ways. You now have unlimited access to all my wisdom about natal charts. You can inquire about your astral configuration, planets, houses, and all celestial mysteries as many times as you wish.\n\n✨ *The universe has opened all its doors for you* ✨',
          timestamp: new Date(),
          isUser: false,
        };
        this.messages.push(premiumMessage);
        this.shouldScrollToBottom = true;
        this.saveMessagesToSession();
        break;
      // ✅ ELIMINADO: case '3' - 2 Consultas Extra
      case '4': // Otra oportunidad
        this.logger.log('🔄 Otra oportunidad celestial concedida');
        break;
      default:
        this.logger.warn('⚠️ Premio celestial desconocido:', prize);
    }
  }
  private addFreeBirthChartConsultations(count: number): void {
    const current = parseInt(
      this.storage.getFreeConsultations('BirthChart').toString() || '0'
    );
    const newTotal = current + count;
    this.storage.setFreeConsultations('BirthChart', newTotal);
    this.logger.log(
      `🎁 Agregadas ${count} consultas de carta natal. Total: ${newTotal}`
    );

    if (this.blockedMessageId && !this.hasUserPaid) {
      this.blockedMessageId = null;
      this.storage.removeBlockedMessageId('birthChart');
      this.logger.log('🔓 Mensaje natal desbloqueado con consulta gratuita');
    }
  }

  private hasFreeBirthChartConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('BirthChart').toString() || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeBirthChartConsultation(): void {
    const freeConsultations = parseInt(
      this.storage.getFreeConsultations('BirthChart').toString() || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      this.storage.setFreeConsultations('BirthChart', remaining);
      this.logger.log(`🎁 Consulta natal gratis usada. Restantes: ${remaining}`);

      const prizeMsg: Message = {
        sender: 'High Priestess Emma',
        content: `✨ *You have used a free astral reading* ✨\n\nYou have **${remaining}** celestial consultations remaining.`,
        timestamp: new Date(),
        isUser: false,
      };
      this.messages.push(prizeMsg);
      this.shouldScrollToBottom = true;
      this.saveMessagesToSession();
    }
  }

  debugBirthChartWheel(): void {
    this.logger.log('=== DEBUG RULETA CARTA NATAL ===');
    this.logger.log('showFortuneWheel:', this.showFortuneWheel);
    this.logger.log(
      'FortuneWheelComponent.canShowWheel():',
      FortuneWheelComponent.canShowWheel()
    );
    this.logger.log('showPaymentModal:', this.showPaymentModal);
    this.logger.log('showDataModal:', this.showDataModal);
    this.logger.log(
      'freeBirthChartConsultations:',
      this.storage.getFreeConsultations('BirthChart').toString()
    );

    this.showFortuneWheel = true;
    this.logger.log('Forzado showFortuneWheel a:', this.showFortuneWheel);
  }

  // ✅ MÉTODO AUXILIAR para el template
  getBirthChartConsultationsCount(): number {
    return parseInt(
      this.storage.getFreeConsultations('BirthChart').toString() || '0'
    );
  }

  // ✅ MÉTODO AUXILIAR para parsing en template
  parseInt(value: string): number {
    return parseInt(value);
  }

  // ✅ MODIFICAR clearChat para incluir datos de la ruleta
}
