# LUKTO Stats ⚽

Aplicación web para trackear estadísticas de partidos de fútbol, win rates, calificaciones de jugadores y más.

![LUKTO Stats](public/lukto-logo.png)

## 🚀 Demo

[lukto-winrate-webapp.vercel.app](https://lukto-winrate-webapp.vercel.app)

## ✨ Características

### Estadísticas
- 📊 Win rate por jugador
- ⭐ Sistema de calificaciones (1-10)
- 🏆 MVPs por partido
- 📈 Gráficas de rendimiento
- 🔥 Rachas (victorias/derrotas consecutivas)
- 🎯 Predicciones pre-partido

### Gamificación
- 🥇 Sistema de rangos (Bronce → Leyenda)
- 🏅 Logros/Badges
- 💎 Sistema de XP
- 👤 Perfiles de jugador
- 📅 Jugador del mes/semana

### Admin
- 👥 Gestión de jugadores
- ⚽ Gestión de partidos
- 🔗 Vinculación de usuarios con Google
- 📋 Logs de actividad
- 🚫 Moderación (bloqueo de usuarios)
- 📊 Dashboard de métricas

## 🛠️ Tech Stack

- **Frontend:** React 18 + Vite
- **Backend:** Firebase (Auth + Firestore)
- **Hosting:** Vercel
- **Gráficas:** Recharts
- **PWA:** Service Worker + Manifest

## 📦 Instalación

```bash
# Clonar repositorio
git clone https://github.com/josefatrix/lukto-winrate-webapp.git
cd lukto-winrate-webapp

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

## ⚙️ Configuración

### Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilita Authentication (Google Sign-In)
3. Crea una base de datos Firestore
4. Copia tu configuración a `src/firebase.js`

### Variables de Entorno (opcional)

Crea un archivo `.env.local`:

```env
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
```

## 📁 Estructura del Proyecto

```
lukto-winrate-webapp/
├── public/                    # Assets estáticos
│   ├── lukto-logo.png
│   ├── manifest.json
│   └── sw.js                  # Service Worker
├── src/
│   ├── components/
│   │   ├── common/            # Componentes reutilizables
│   │   │   ├── Modal.jsx
│   │   │   ├── Toast.jsx
│   │   │   └── Skeleton.jsx
│   │   ├── layout/            # Layout components
│   │   │   ├── Header.jsx
│   │   │   └── BottomNav.jsx
│   │   ├── tabs/              # Tabs principales
│   │   │   ├── StatsTab.jsx
│   │   │   ├── RatingsTab.jsx
│   │   │   └── MatchesTab.jsx
│   │   └── modals/            # Modales
│   │       ├── AdminLoginModal.jsx
│   │       └── PendingUserModal.jsx
│   ├── contexts/
│   │   └── AppContext.jsx     # Estado global
│   ├── hooks/
│   │   └── useStats.js        # Lógica de estadísticas
│   ├── utils/                 # Funciones auxiliares
│   ├── constants/             # Configuración
│   ├── App.jsx                # Componente principal
│   ├── firebase.js            # Config Firebase
│   ├── index.css              # Estilos globales
│   └── main.jsx               # Entry point
├── index.html
├── vite.config.js
└── package.json
```

## 🔐 Seguridad

### Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if request.auth != null;
    }
    
    match /players/{playerId} {
      allow write: if request.auth != null;
    }
    
    match /matches/{matchId} {
      allow write: if request.auth != null;
    }
    
    match /ratings/{ratingId} {
      allow write: if request.auth != null;
    }
    
    match /userLinks/{userId} {
      allow write: if request.auth != null;
    }
    
    match /settings/{settingId} {
      allow write: if request.auth != null;
    }
  }
}
```

## 📱 PWA

La app es instalable como PWA:
- **iOS:** Safari → Compartir → Agregar a inicio
- **Android:** Chrome → Menú → Instalar app
- **Desktop:** Click en el ícono de instalación en la barra de direcciones

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

MIT © 2026

## 👨‍💻 Autor

**Jose Escorcia**
- GitHub: [@josefatrix](https://github.com/josefatrix)
