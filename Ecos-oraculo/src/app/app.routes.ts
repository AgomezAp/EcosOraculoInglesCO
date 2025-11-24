import { Routes } from '@angular/router';


export const routes: Routes = [
  {
    path: '',
    redirectTo: 'welcome',
    pathMatch: 'full',
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./components/bienvenida/bienvenida.component').then(
        (m) => m.BienvenidaComponent
      ),
  },
  {
    path: 'dream-meaning',
    loadComponent: () =>
      import(
        './components/significado-suenos/significado-suenos.component'
      ).then((m) => m.SignificadoSuenosComponent),
  },
  {
    path: 'zodiac-info',
    loadComponent: () =>
      import(
        './components/informacion-zodiaco/informacion-zodiaco.component'
      ).then((m) => m.InformacionZodiacoComponent),
  },
  {
    path: 'numerology-reading',
    loadComponent: () =>
      import(
        './components/lectura-numerologia/lectura-numerologia.component'
      ).then((m) => m.LecturaNumerologiaComponent),
  },
  {
    path: 'vocational-map',
    loadComponent: () =>
      import('./components/mapa-vocacional/mapa-vocacional.component').then(
        (m) => m.MapaVocacionalComponent
      ),
  },
  {
    path: 'inner-animal',
    loadComponent: () =>
      import('./components/animal-interior/animal-interior.component').then(
        (m) => m.AnimalInteriorComponent
      ),
  },
  {
    path: 'birth-chart',
    loadComponent: () =>
      import('./components/tabla-nacimiento/tabla-nacimiento.component').then(
        (m) => m.TablaNacimientoComponent
      ),
  },
  {
    path: 'horoscope',
    loadComponent: () =>
      import('./components/zodiaco-chino/zodiaco-chino.component').then(
        (m) => m.ZodiacoChinoComponent
      ),
  },
  {
    path: 'love-calculator',
    loadComponent: () =>
      import('./components/calculadora-amor/calculadora-amor.component').then(
        (m) => m.CalculadoraAmorComponent
      ),
  },
  {
    path: 'ecos-terms',
    loadComponent: () =>
      import(
        './components/terminos-condiciones/terminos-condiciones.component'
      ).then((m) => m.TerminosCondicionesEcos),
  },
  {
    path: 'cookies-policy',
    loadComponent: () =>
      import('./components/cookies/cookies.component').then(
        (m) => m.CookiesComponent
      ),
  },
];
