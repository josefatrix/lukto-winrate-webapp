# Guía de Contribución

¡Gracias por tu interés en contribuir a LUKTO Stats! 🎉

## 🚀 Cómo Empezar

### 1. Fork y Clone

```bash
# Fork el repositorio en GitHub, luego:
git clone https://github.com/TU-USUARIO/lukto-winrate-webapp.git
cd lukto-winrate-webapp
npm install
```

### 2. Crear Branch

```bash
# Para nueva funcionalidad
git checkout -b feature/nombre-descriptivo

# Para bug fix
git checkout -b fix/descripcion-del-bug
```

### 3. Desarrollo Local

```bash
npm run dev
```

## 📝 Convenciones de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<scope>): <descripción>

[cuerpo opcional]

[footer opcional]
```

### Tipos permitidos:

| Tipo | Descripción |
|------|-------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Cambios en documentación |
| `style` | Formato, espacios, etc. (sin cambio de código) |
| `refactor` | Refactorización |
| `perf` | Mejora de rendimiento |
| `test` | Agregar o modificar tests |
| `chore` | Mantenimiento, dependencias |

### Ejemplos:

```bash
feat(ratings): add 5-star rating system
fix(auth): resolve Google login on iOS
docs(readme): update installation steps
refactor(stats): simplify calculation logic
```

## 🔀 Pull Requests

1. Asegúrate que tu código pase el linter
2. Actualiza documentación si es necesario
3. Describe claramente los cambios en el PR
4. Agrega screenshots si hay cambios de UI
5. Espera la revisión de código

## 🎨 Estilo de Código

- **JavaScript/React:** Sigue la configuración de ESLint
- **CSS:** Usa variables CSS definidas en `index.css`
- **Componentes:** Functional components con hooks
- **Nombres:** camelCase para variables, PascalCase para componentes

## 📁 Estructura del Proyecto

```
src/
├── components/     # Componentes React
│   ├── common/     # Componentes reutilizables
│   ├── layout/     # Header, Nav, etc.
│   ├── modals/     # Modales
│   ├── stats/      # Componentes de estadísticas
│   └── tabs/       # Tabs principales
├── contexts/       # React Context
├── hooks/          # Custom hooks
├── utils/          # Funciones utilitarias
├── constants/      # Constantes
└── styles/         # CSS adicionales
```

## 🐛 Reportar Bugs

Usa el template de [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)

## ✨ Sugerir Features

Usa el template de [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md)

## 📜 Código de Conducta

- Sé respetuoso
- Acepta críticas constructivas
- Enfócate en lo mejor para la comunidad

---

¿Preguntas? Abre un issue o contacta al maintainer.

