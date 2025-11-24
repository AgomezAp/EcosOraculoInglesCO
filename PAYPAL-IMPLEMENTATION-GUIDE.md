# Guía de Implementación de PayPal para Componentes

## Archivos a Modificar

### 1. lectura-numerologia.component.ts
### 2. significado-suenos.component.ts  
### 3. calculadora-amor.component.ts

---

## CAMBIOS NECESARIOS

### 1. IMPORTS (Aplicar a TODOS los componentes)

**ELIMINAR:**
```typescript
import {
  loadStripe,
  Stripe,
  StripeElements,
  StripePaymentElement,
} from '@stripe/stripe-js';
```

**AGREGAR:**
```typescript
import { PaypalService } from '../../services/paypal.service';
```

---

### 2. VARIABLES DE CLASE (Aplicar a TODOS los componentes)

**ELIMINAR:**
```typescript
  stripe: Stripe | null = null;
  elements: StripeElements | undefined;
  paymentElement: StripePaymentElement | undefined;
  clientSecret: string | null = null;
```

**MANTENER (ya están correctas):**
```typescript
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
```

---

### 3. CONSTRUCTOR (Aplicar a TODOS los componentes)

**AGREGAR al constructor:**
```typescript
private paypalService: PaypalService
```

**Ejemplo para numerología:**
```typescript
constructor(
  @Optional() public dialogRef: MatDialogRef<LecturaNumerologiaComponent>,
  @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
  private numerologyService: NumerologiaService,
  private http: HttpClient,
  private elRef: ElementRef<HTMLElement>,
  private logger: LoggerService,
  private storage: StorageService,
  private paypalService: PaypalService  // ← AGREGAR ESTA LÍNEA
) {}
```

---

### 4. ngOnInit() - Verificación de Pago (Aplicar a TODOS los componentes)

**Buscar la llamada a `this.checkPaymentStatus()` en ngOnInit y ASEGURARSE de que es `await`:**

```typescript
async ngOnInit(): Promise<void> {
  // ... código existente ...
  
  // Verificar URL para pagos exitosos de PayPal
  await this.checkPaymentStatus();  // ← IMPORTANTE: agregar await
  
  // ... resto del código ...
}
```

---

### 5. MÉTODO checkPaymentStatus() (Aplicar a TODOS)

**REEMPLAZAR TODO EL MÉTODO con:**

#### Para Numerología (lectura-numerologia.component.ts):
```typescript
private async checkPaymentStatus(): Promise<void> {
  // ✅ Verificar pago SOLO de este servicio específico
  this.hasUserPaidForNumerology = this.storage.hasUserPaid('Numerology');

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

        // ✅ MENSAJE VISIBLE DE PAGO EXITOSO
        setTimeout(() => {
          const confirmationMsg: ConversationMessage = {
            role: 'numerologist',
            message:
              '🎉 Payment completed successfully!\\n\\n' +
              '✨ Thank you for your payment. You now have full access to Numerology.\\n\\n' +
              '🔢 Let\'s discover the secrets of sacred numbers together!\\n\\n' +
              '📌 Note: This payment is only valid for the Numerology service.',
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
        this.paymentError = 'Payment could not be verified.';
      }
    } catch (error) {
      this.logger.error('Error verificando pago de PayPal:', error);
      this.paymentError = 'Error in payment verification';
    }
  }
}
```

#### Para Sueños (significado-suenos.component.ts):
```typescript
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
            sender: 'Seraphina',
            content:
              '🎉 Payment completed successfully!\\n\\n' +
              '✨ Thank you. You now have full access to Dream Interpretation.\\n\\n' +
              '🌙 Let\'s uncover the mysteries of your dreams together!',
            timestamp: new Date(),
            isUser: false,
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
```

#### Para Amor (calculadora-amor.component.ts):
```typescript
private async checkPaymentStatus(): Promise<void> {
  this.hasUserPaidForLove = this.storage.hasUserPaid('Love');

  const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();

  if (paymentStatus && paymentStatus.status === 'COMPLETED') {
    try {
      const verification = await this.paypalService.verifyAndProcessPayment(
        paymentStatus.token
      );

      if (verification.valid && verification.status === 'approved') {
        this.hasUserPaidForLove = true;
        this.storage.setUserPaid('Love', true);

        this.blockedMessageId = null;
        this.storage.removeBlockedMessageId('love');

        window.history.replaceState({}, document.title, window.location.pathname);

        this.showPaymentModal = false;
        this.isProcessingPayment = false;
        this.paymentError = null;

        setTimeout(() => {
          const confirmationMsg: ConversationMessage = {
            role: 'expert',
            message:
              '🎉 Payment completed successfully!\\n\\n' +
              '✨ Thank you. You now have full access to Love Analysis.\\n\\n' +
              '💕 Let\'s explore the depths of your love compatibility!',
            timestamp: new Date(),
          };
          this.conversationHistory.push(confirmationMsg);
          this.shouldAutoScroll = true;
          this.saveMessagesToSession();

          const pendingMessage = this.storage.getSessionItem<string>('pendingLoveMessage');
          if (pendingMessage) {
            this.storage.removeSessionItem('pendingLoveMessage');
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
```

---

### 6. MÉTODO ngOnDestroy() (Aplicar a TODOS)

**ELIMINAR todas las referencias a `paymentElement`:**

**ANTES:**
```typescript
ngOnDestroy(): void {
  if (this.paymentElement) {
    try {
      this.paymentElement.destroy();
    } catch (error) {
      this.logger.log('Error al destruir elemento de pago:', error);
    } finally {
      this.paymentElement = undefined;
    }
  }
  if (this.wheelTimer) {
    clearTimeout(this.wheelTimer);
  }
}
```

**DESPUÉS:**
```typescript
ngOnDestroy(): void {
  if (this.wheelTimer) {
    clearTimeout(this.wheelTimer);
  }
}
```

---

### 7. MÉTODO promptForPayment() (Aplicar a TODOS)

**REEMPLAZAR TODO EL MÉTODO con:**

#### Para Numerología:
```typescript
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
```

#### Para Sueños - cambiar nombres de variables:
```typescript
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
```

#### Para Amor - cambiar nombres de variables:
```typescript
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
    this.storage.setSessionItem('pendingLoveMessage', this.currentMessage);
  }
}
```

---

### 8. MÉTODO handlePaymentSubmit() (Aplicar a TODOS)

**REEMPLAZAR TODO EL MÉTODO con:**

#### Para Numerología:
```typescript
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
```

#### Para Sueños:
```typescript
async handlePaymentSubmit(): Promise<void> {
  this.isProcessingPayment = true;
  this.paymentError = null;

  try {
    const orderData = {
      amount: '7.00',
      currency: 'EUR',
      serviceName: 'Dream Interpretation',
      returnPath: '/dream-interpretation',
      cancelPath: '/dream-interpretation',
    };

    await this.paypalService.initiatePayment(orderData);
  } catch (error: any) {
    this.paymentError = error.message || 'Error initializing PayPal payment.';
    this.isProcessingPayment = false;
  }
}
```

#### Para Amor:
```typescript
async handlePaymentSubmit(): Promise<void> {
  this.isProcessingPayment = true;
  this.paymentError = null;

  try {
    const orderData = {
      amount: '7.00',
      currency: 'EUR',
      serviceName: 'Love Compatibility Analysis',
      returnPath: '/love-calculator',
      cancelPath: '/love-calculator',
    };

    await this.paypalService.initiatePayment(orderData);
  } catch (error: any) {
    this.paymentError = error.message || 'Error initializing PayPal payment.';
    this.isProcessingPayment = false;
  }
}
```

---

### 9. MÉTODO cancelPayment() (YA DEBE EXISTIR - verificar)

```typescript
cancelPayment(): void {
  this.showPaymentModal = false;
  this.isProcessingPayment = false;
  this.paymentError = null;
}
```

---

## RESUMEN DE NOMBRES DE VARIABLES POR COMPONENTE

### Numerología:
- `hasUserPaidForNumerology`
- `pendingNumerologyMessage`
- `this.messages` (array de mensajes)
- `this.currentMessage` (mensaje actual)
- `ConversationMessage` (tipo de interfaz)
- `role: 'numerologist'`

### Sueños:
- `hasUserPaidForDreams`
- `pendingDreamMessage`
- `this.messages` (array de mensajes)
- `this.messageText` (mensaje actual)
- `ConversationMessage` (tipo de interfaz)
- `sender: 'Seraphina'`

### Amor:
- `hasUserPaidForLove`
- `pendingLoveMessage`
- `this.conversationHistory` (array de mensajes)
- `this.currentMessage` (mensaje actual)
- `ConversationMessage` (tipo de interfaz)
- `role: 'expert'`

---

## IMPORTANTE: RUTAS DE RETORNO EN returnPath

- Numerología: `'/numerology'` o la ruta alemana que uses
- Sueños: `'/dream-interpretation'` o la ruta alemana que uses
- Amor: `'/love-calculator'` o la ruta alemana que uses

**NOTA:** Asegúrate de que las rutas coincidan exactamente con las rutas configuradas en `app.routes.ts`
