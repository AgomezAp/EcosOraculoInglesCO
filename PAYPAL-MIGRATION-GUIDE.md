# Migración de Stripe a PayPal - Guía Completa

## ✅ COMPLETADO

### Backend
- ✅ `.env` actualizado con configuración de PayPal
- ✅ `controllers/paypal.ts` - Controlador PayPal implementado
- ✅ `routes/paypal.ts` - Rutas PayPal configuradas
- ✅ `controllers/Pagos.ts` - Marcado como deprecado
- ✅ `models/Pagos.ts` - Marcado como deprecado

### Frontend - Configuración
- ✅ `src/index.html` - Script de Stripe comentado
- ✅ `src/app/environments/environments.ts` - Claves Stripe removidas
- ✅ `src/app/services/paypal.service.ts` - Servicio PayPal implementado

### Frontend - Componentes Migrados
- ✅ `mapa-vocacional.component.ts` - Usando PayPal completamente

## 🔄 PENDIENTE DE MIGRACIÓN

### Componentes que usan Stripe (necesitan migración):

1. **zodiaco-chino.component.ts** - Horóscopo Chino
2. **tabla-nacimiento.component.ts** - Tabla de Nacimiento
3. **lectura-numerologia.component.ts** - Lectura de Numerología
4. **significado-suenos.component.ts** - Significado de Sueños
5. **animal-interior.component.ts** - Animal Interior
6. **calculadora-amor.component.ts** - Calculadora del Amor

## 📋 PASOS PARA MIGRAR CADA COMPONENTE

### 1. Importaciones (arriba del archivo)
```typescript
// ❌ REMOVER:
import {
  loadStripe,
  Stripe,
  StripeElements,
  StripePaymentElement,
} from '@stripe/stripe-js';

// ✅ AGREGAR:
import { PaypalService } from '../../services/paypal.service';
```

### 2. Variables del Componente
```typescript
// ❌ REMOVER:
showPaymentModal: boolean = false;
stripe: Stripe | null = null;
elements: StripeElements | undefined;
paymentElement: StripePaymentElement | undefined;
isProcessingPayment: boolean = false;
paymentError: string | null = null;
private stripePublishableKey = environment.stripePublicKey;

// ✅ AGREGAR:
showPaymentModal: boolean = false;
isProcessingPayment: boolean = false;
paymentError: string | null = null;
showDataModal: boolean = false;
userData: any = null;
```

### 3. Constructor
```typescript
// ✅ AGREGAR:
constructor(
  // ... otros servicios existentes
  private paypalService: PaypalService
) {}
```

### 4. ngOnInit - Verificar Pago
```typescript
async ngOnInit(): Promise<void> {
  // ✅ AGREGAR AL INICIO:
  // Verificar pago específico del servicio
  this.hasUserPaidForService = sessionStorage.getItem('hasUserPaidFor_<NOMBRE_SERVICIO>') === 'true';
  
  const paymentStatus = this.paypalService.checkPaymentStatusFromUrl();
  
  if (paymentStatus && paymentStatus.status === 'COMPLETED') {
    try {
      const verification = await this.paypalService.verifyAndProcessPayment(paymentStatus.token);
      
      if (verification.valid && verification.status === 'approved') {
        this.hasUserPaidForService = true;
        sessionStorage.setItem('hasUserPaidFor_<NOMBRE_SERVICIO>', 'true');
        
        this.blockedMessageId = null;
        sessionStorage.removeItem('<SERVICIO>BlockedMessageId');
        
        window.history.replaceState({}, document.title, window.location.pathname);
        
        this.showPaymentModal = false;
        this.isProcessingPayment = false;
        this.paymentError = null;
        
        this.cdr.markForCheck();
        
        setTimeout(() => {
          this.addMessage({
            sender: this.expertInfo.name,
            content: '🎉 Payment completed successfully!\n\n✨ Thank you for your payment. You now have full access to [SERVICE NAME].',
            timestamp: new Date(),
            isUser: false,
          });
          
          this.cdr.detectChanges();
          setTimeout(() => {
            this.scrollToBottom();
            this.cdr.markForCheck();
          }, 200);
        }, 1000);
      }
    } catch (error) {
      this.paymentError = 'Payment verification error';
    }
  }
  
  // Cargar datos del usuario desde sessionStorage
  const savedUserData = sessionStorage.getItem('userData');
  if (savedUserData) {
    try {
      this.userData = JSON.parse(savedUserData);
    } catch (error) {
      this.userData = null;
    }
  }
  
  // ... resto del código existente
}
```

### 5. ngOnDestroy - Limpiar
```typescript
ngOnDestroy(): void {
  // ❌ REMOVER código de Stripe
  // ✅ Mantener solo limpieza general
  if (this.wheelTimer) {
    clearTimeout(this.wheelTimer);
  }
}
```

### 6. Métodos de Pago
```typescript
// ❌ REMOVER:
// - checkPaymentStatus()
// - initStripePayment()
// - handlePaymentSubmit() [versión Stripe]

// ✅ AGREGAR:
async handlePaymentSubmit(): Promise<void> {
  this.isProcessingPayment = true;
  this.paymentError = null;
  this.cdr.markForCheck();

  try {
    const orderData = {
      amount: '4.00',
      currency: 'EUR',
      serviceName: '<NOMBRE DEL SERVICIO>',
      returnPath: '/<RUTA-DEL-COMPONENTE>',
      cancelPath: '/<RUTA-DEL-COMPONENTE>',
    };

    await this.paypalService.initiatePayment(orderData);
  } catch (error: any) {
    this.paymentError = error.message || 'Error initializing PayPal payment.';
    this.isProcessingPayment = false;
    this.cdr.markForCheck();
  }
}

cancelPayment(): void {
  this.showPaymentModal = false;
  this.isProcessingPayment = false;
  this.paymentError = null;
  this.cdr.markForCheck();
}
```

### 7. Manejo de Datos de Usuario
```typescript
onUserDataSubmitted(userData: any): void {
  const requiredFields = ['email'];
  const missingFields = requiredFields.filter(
    (field) => !userData[field] || userData[field].toString().trim() === ''
  );

  if (missingFields.length > 0) {
    alert(`Please fill in: ${missingFields.join(', ')}`);
    this.showDataModal = true;
    this.cdr.markForCheck();
    return;
  }

  this.userData = {
    ...userData,
    email: userData.email?.toString().trim(),
  };

  try {
    sessionStorage.setItem('userData', JSON.stringify(this.userData));
  } catch (error) {
    console.error('Error saving user data:', error);
  }

  this.showDataModal = false;
  this.cdr.markForCheck();

  this.sendUserDataToBackend(userData);
}

private sendUserDataToBackend(userData: any): void {
  this.http.post(`${environment.apiUrl}api/recolecta`, userData).subscribe({
    next: (response) => {
      this.promptForPayment();
    },
    error: (error) => {
      this.promptForPayment();
    },
  });
}

onDataModalClosed(): void {
  this.showDataModal = false;
  this.cdr.markForCheck();
}
```

## 🎯 NOMBRES DE SERVICIOS ESPECÍFICOS

Reemplazar `<NOMBRE_SERVICIO>` con:
- `chineseZodiac` - Zodiaco Chino
- `birthChart` - Tabla de Nacimiento
- `numerology` - Numerología
- `dreamMeaning` - Significado de Sueños
- `innerAnimal` - Animal Interior
- `loveCalculator` - Calculadora del Amor

## 🔧 VERIFICACIÓN FINAL

Para cada componente migrado:
1. ✅ Imports actualizados (remover Stripe, agregar PayPal)
2. ✅ Variables actualizadas
3. ✅ Constructor actualizado con PaypalService
4. ✅ ngOnInit con verificación de pago PayPal
5. ✅ Métodos de pago actualizados
6. ✅ Manejo de datos de usuario implementado
7. ✅ HTML actualizado (remover elementos Stripe, agregar recolecta-datos)
8. ✅ Probar flujo completo de pago

## 📝 NOTAS IMPORTANTES

1. **SessionStorage específico**: Cada servicio usa su propia clave en sessionStorage
2. **Rutas correctas**: Asegurar que returnPath y cancelPath coincidan con las rutas del routing
3. **Mensajes en inglés**: Todos los mensajes del usuario deben estar en inglés
4. **Datos persistentes**: userData se guarda en sessionStorage global, payment status específico por servicio
