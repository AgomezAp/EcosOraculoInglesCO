# Pasos Rápidos para Completar la Implementación de PayPal

## ✅ YA COMPLETADO:
1. ✓ paypal.service.ts creado
2. ✓ lectura-numerologia.component.ts - imports y constructor actualizados
3. ✓ significado-suenos.component.ts - imports y constructor actualizados

## 📋 PENDIENTE POR HACER:

### A. COMPONENTE: significado-suenos.component.ts

Busca y reemplaza las siguientes funciones COMPLETAS:

#### 1. Reemplazar ngOnDestroy():
```typescript
ngOnDestroy(): void {
  if (this.wheelTimer) {
    clearTimeout(this.wheelTimer);
  }
}
```

#### 2. Reemplazar checkPaymentStatus():
```typescript
private async checkPaymentStatus(): Promise<void> {
  this.hasUserPaidForDreams = this.storage.hasUserPaidForDreams();

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

#### 3. Reemplazar promptForPayment():
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

#### 4. Reemplazar handlePaymentSubmit():
```typescript
async handlePaymentSubmit(): Promise<void> {
  this.isProcessingPayment = true;
  this.paymentError = null;

  try {
    const orderData = {
      amount: '7.00',
      currency: 'EUR',
      serviceName: 'Dream Interpretation',
      returnPath: '/traumdeutung',  // ← AJUSTA ESTA RUTA ALEMANA
      cancelPath: '/traumdeutung',   // ← AJUSTA ESTA RUTA ALEMANA
    };

    await this.paypalService.initiatePayment(orderData);
  } catch (error: any) {
    this.paymentError = error.message || 'Error initializing PayPal payment.';
    this.isProcessingPayment = false;
  }
}
```

#### 5. Agregar o Reemplazar cancelPayment():
```typescript
cancelPayment(): void {
  this.showPaymentModal = false;
  this.isProcessingPayment = false;
  this.paymentError = null;
}
```

---

### B. COMPONENTE: calculadora-amor.component.ts

#### 1. Agregar en imports:
```typescript
import { PaypalService } from '../../services/paypal.service';
```

#### 2. Eliminar imports de Stripe:
```typescript
// ELIMINAR ESTO:
import {
  loadStripe,
  Stripe,
  StripeElements,
  StripePaymentElement,
} from '@stripe/stripe-js';
```

#### 3. Reemplazar variables de pago:
```typescript
// ELIMINAR:
stripe: Stripe | null = null;
elements: StripeElements | undefined;
paymentElement: StripePaymentElement | undefined;
clientSecret: string | null = null;

// MANTENER SOLO:
showPaymentModal: boolean = false;
isProcessingPayment: boolean = false;
paymentError: string | null = null;
hasUserPaidForLove: boolean = false;
```

#### 4. Agregar al constructor:
```typescript
constructor(
  ...existing params...,
  private paypalService: PaypalService
) {}
```

#### 5. Reemplazar ngOnDestroy():
```typescript
ngOnDestroy(): void {
  if (this.wheelTimer) {
    clearTimeout(this.wheelTimer);
  }
}
```

#### 6. Reemplazar checkPaymentStatus():
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

#### 7. Reemplazar promptForPayment():
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

#### 8. Reemplazar handlePaymentSubmit():
```typescript
async handlePaymentSubmit(): Promise<void> {
  this.isProcessingPayment = true;
  this.paymentError = null;

  try {
    const orderData = {
      amount: '7.00',
      currency: 'EUR',
      serviceName: 'Love Compatibility Analysis',
      returnPath: '/liebesrechner',  // ← AJUSTA ESTA RUTA ALEMANA
      cancelPath: '/liebesrechner',   // ← AJUSTA ESTA RUTA ALEMANA
    };

    await this.paypalService.initiatePayment(orderData);
  } catch (error: any) {
    this.paymentError = error.message || 'Error initializing PayPal payment.';
    this.isProcessingPayment = false;
  }
}
```

#### 9. Agregar o Reemplazar cancelPayment():
```typescript
cancelPayment(): void {
  this.showPaymentModal = false;
  this.isProcessingPayment = false;
  this.paymentError = null;
}
```

---

## 🔍 RUTAS A VERIFICAR Y AJUSTAR

Revisa tu archivo `app.routes.ts` y ajusta las rutas en `returnPath` y `cancelPath`:

### Para Numerología:
- Busca la ruta: podría ser `/numerology`, `/numerologie`, `/numerologia-lectura`, etc.
- Ajusta en línea ~740 de lectura-numerologia.component.ts

### Para Sueños:
- Busca la ruta: podría ser `/dream-interpretation`, `/traumdeutung`, `/significado-suenos`, etc.
- Ajusta en handlePaymentSubmit() de significado-suenos.component.ts

### Para Amor:
- Busca la ruta: podría ser `/love-calculator`, `/liebesrechner`, `/calculadora-amor`, etc.
- Ajusta en handlePaymentSubmit() de calculadora-amor.component.ts

**IMPORTANTE:** Las rutas deben coincidir exactamente con las definidas en tu `app.routes.ts`

---

## ✅ VERIFICACIÓN FINAL

1. **Verificar que NO haya referencias a:**
   - `loadStripe`
   - `Stripe`
   - `StripeElements`
   - `StripePaymentElement`
   - `this.stripe`
   - `this.elements`
   - `this.paymentElement`
   - `this.clientSecret`

2. **Verificar que SÍ existan:**
   - `import { PaypalService } from '../../services/paypal.service';`
   - `private paypalService: PaypalService` en constructor
   - `this.paypalService.initiatePayment()` en handlePaymentSubmit
   - `this.paypalService.checkPaymentStatusFromUrl()` en checkPaymentStatus
   - `this.paypalService.verifyAndProcessPayment()` en checkPaymentStatus

3. **Compilar y probar:**
   ```bash
   ng build
   ```

---

## 🎯 NOTAS IMPORTANTES

- El monto está configurado en `'7.00'` EUR para todos los servicios
- Cada servicio tiene su propio flag de pago (Numerology, Dreams, Love)
- Los mensajes pendientes se guardan por servicio
- PayPal redirige automáticamente después del pago
- La verificación ocurre en ngOnInit cuando el usuario regresa

---

## 📞 SI HAY PROBLEMAS

Verifica:
1. Que `paypal.service.ts` exista en `src/app/services/`
2. Que las rutas de retorno coincidan con `app.routes.ts`
3. Que el backend tenga los endpoints `/api/paypal/create-order` y `/api/paypal/capture-order`
4. Que `environment.apiUrl` esté correctamente configurado
