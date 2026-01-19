# 🚀 Guía de Deploy - LUKTO Winrate

## ⚡ Setup Inicial (ejecutar una vez)

```bash
# Ejecutar el script de configuración
chmod +x setup-branches.sh && ./setup-branches.sh
```

O manualmente:
```bash
git add -A
git commit -m "feat: add deploy workflow scripts and guide"
git tag -a v1.5.0 -m "Versión estable - producción actual"
git checkout -b develop
git push origin main develop --tags
```

---

## 🌿 Estructura de Ramas

```
main (v1.5.0) ← Producción estable (NO tocar directamente)
  │
  └── develop ← Desarrollo activo
        │
        ├── feature/nueva-feature
        └── fix/bug-fix
```

---

## Flujo de Trabajo Recomendado

```
Desarrollo → Test Local → Preview → Producción
```

---

## 1️⃣ Desarrollo Local

```bash
npm run dev
```
- URL: http://localhost:3001
- Hot reload automático
- Para probar en móvil (misma red WiFi):
  ```bash
  npm run dev:host
  ```

---

## 2️⃣ Test Local (Simula Producción)

```bash
npm run test:local
```
- Hace build y levanta preview
- URL: http://localhost:4173
- **Verifica que todo funcione antes de subir**

---

## 3️⃣ Deploy Preview (Staging)

```bash
npm run deploy:preview
```
- Sube a Vercel como **preview** (no producción)
- Te da una URL temporal única
- Puedes compartir para que otros prueben
- **No afecta la versión en producción**

---

## 4️⃣ Deploy Producción

```bash
npm run deploy:prod
```
- Sube a producción en Vercel
- **Solo ejecutar cuando todo esté probado**

---

## ✅ Checklist Pre-Deploy

Antes de `deploy:prod`, verifica:

- [ ] Build sin errores (`npm run build`)
- [ ] Probado en localhost preview
- [ ] Funcionalidades principales OK:
  - [ ] Login/logout
  - [ ] Ver rankings
  - [ ] Crear partidos
  - [ ] Calificar jugadores
  - [ ] Predicciones
  - [ ] Perfil de usuario
- [ ] Sin errores en consola del navegador
- [ ] UI responsive (móvil/desktop)
- [ ] Commit hecho en Git

---

## 🔄 Comandos Rápidos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo local |
| `npm run dev:host` | Desarrollo + acceso desde móvil |
| `npm run test:local` | Build + Preview local |
| `npm run deploy:preview` | Deploy a staging |
| `npm run deploy:prod` | Deploy a producción |

---

## 🆘 Rollback de Emergencia

Si algo sale mal en producción:

```bash
# Ver deploys anteriores
npx vercel ls

# Promover un deploy anterior a producción
npx vercel promote <deployment-url>
```

O desde el dashboard de Vercel → Deployments → "..." → "Promote to Production"

---

## 📱 Probar en Móvil (Mismo WiFi)

1. Ejecuta `npm run dev:host`
2. Encuentra tu IP local:
   ```bash
   # Mac
   ipconfig getifaddr en0
   ```
3. En el móvil, abre: `http://TU-IP:3001`

---

## 🌿 Flujo de Ramas (Feature Development)

### Crear nueva feature:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/nombre-feature
# ... trabajas en los cambios ...
git add -A && git commit -m "feat: descripción de cambios"
```

### Probar en preview (staging):
```bash
git checkout develop
git merge feature/nombre-feature
npm run deploy:preview
# Vercel te da URL temporal para probar
```

### Llevar a producción:
```bash
git checkout main
git merge develop
git tag -a v1.X.0 -m "Descripción de la versión"
npm run deploy:prod
git push origin main --tags
```

### Volver a develop para seguir trabajando:
```bash
git checkout develop
```

---

## 🏷️ Versionado

- **v1.X.0** - Nueva feature mayor
- **v1.5.X** - Bug fixes menores
- **v2.0.0** - Cambios breaking/rediseño

Ver versión actual:
```bash
git describe --tags
```

Ver qué hay en develop que no está en producción:
```bash
git log main..develop --oneline
```

