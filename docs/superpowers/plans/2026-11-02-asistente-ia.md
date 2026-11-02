# Asistente de IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al grupo un bot de estadísticas en lenguaje natural, y al admin un asistente que traduce órdenes habladas en restricciones que el balanceador existente ejecuta.

**Architecture:** Una Vercel Function (`api/assistant.js`) guarda la key de Anthropic, verifica el ID token de Firebase, cobra un cupo diario en Firestore y llama a la Messages API. El cliente construye el bloque de hechos con los números que ya tiene en pantalla y, cuando la respuesta trae una acción, la valida y la ejecuta con el balanceador — el modelo nunca reparte jugadores.

**Tech Stack:** Vite + React 18, Firebase (Auth + Firestore), `@anthropic-ai/sdk`, `firebase-admin`, Vercel Functions (Node), `node --test`.

**Spec:** [docs/superpowers/specs/2026-11-02-asistente-ia-design.md](../specs/2026-11-02-asistente-ia-design.md)

## Global Constraints

- Modelos exactos: `claude-haiku-5-5` (modo `stats`), `claude-sonnet-5-5` (modo `builder`). Sin sufijos de fecha.
- `thinking` se omite del request. No se envían `temperature`, `top_p` ni `top_k` (400 en ambos modelos).
- `output_config.effort`: `low` en `stats`, `medium` en `builder`. Siempre explícito.
- `max_tokens`: 4000 en `stats`, 8000 en `builder`.
- Modo `builder` usa `client.beta.messages.create` con `betas: ['server-side-fallback-2026-07-01']` y `fallbacks: 'default'`. Modo `stats` usa `client.messages.create`.
- Salida por `output_config.format` (structured outputs). Nunca herramientas, nunca `tool_choice` forzado.
- Historial **solo-añadir**: `system`, y todos los mensajes anteriores, byte a byte idénticos entre peticiones. Los bloques de `content` que devuelve la API se reenvían sin modificar. Tope 10 turnos; al llegar, conversación nueva.
- Nunca se mezclan los dos modelos en una conversación.
- Secretos sin prefijo `VITE_`: `ANTHROPIC_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`.
- Cupo: 15 preguntas/día por usuario, 50 para admins. Se reserva antes de llamar, se devuelve si la llamada falla.
- Entrada: `mode` ∈ `{stats, builder}`; `question` 1–500 caracteres; `facts` serializado < 60 KB; `history` ≤ 10 turnos.
- Super admin: `joseescorcia01@gmail.com`, y `settings/admins.emails`, ambos exigiendo `email_verified`.
- Todo el texto visible al usuario en español, en el tono del resto de la app.
- Tests: `node --test`, `node:assert/strict`, módulos puros bajo `src/utils/` o `api/_lib/`, siguiendo el idioma de `tests/attendanceEligibility.test.js`.

## Review Focus

Entradas que el diseño implica pero que ninguna tarea ejercitaría por sí sola. Cada línea tiene su test asignado a la tarea dueña del código.

1. **`playerId` vinculado a un jugador borrado** — `quienPregunta` no debe lanzar; el asistente responde sin datos personales en vez de romperse. (Tarea 7)
2. **Periodo activo sin partidos** (filtro "semana" en un grupo que no jugó) — `jugadores[]` vacío; el bot dice que no hay datos del periodo, no inventa ni cae al histórico. (Tareas 7 y 3)
3. **Dos pestañas del mismo usuario preguntando a la vez** — el cupo real no se pasa de 15 y el contador que muestra la UI converge al valor del servidor. (Tareas 5 y 8)
4. **La convocatoria cambia mientras la respuesta viaja** — la acción llega referida a jugadores que ya no están seleccionados; se rechaza con aviso en vez de aplicarse a medias. (Tarea 7)
5. **Respuesta del modelo con `respuesta` vacía, o truncada por `max_tokens`** — la hoja nunca queda en blanco; muestra un mensaje de error legible. (Tareas 3 y 9)

---

### Task 1: Extraer el balanceador a un módulo puro

El algoritmo vive hoy en `useCallback`s que capturan estado del hook, así que no se puede testear. Esta tarea no cambia comportamiento: extrae y prueba equivalencia. Va en su propio commit.

**Files:**
- Create: `src/utils/teamBalancer.js`
- Create: `tests/teamBalancer.test.js`
- Modify: `src/hooks/useMatchBuilder.js:517-687` (reemplazar cuerpos por llamadas al módulo)
- Modify: `package.json` (script `test`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `scorePlayer(statsEntry)` → `number`. `statsEntry` es `{ avgRating, winRate, mvps, played }` o `undefined`; `undefined` → `50`. Fórmula exacta copiada de `useMatchBuilder.js:518-526`. **Nombre distinto a propósito**: el hook sigue exponiendo `getPlayerBalanceScore(playerId)` como un envoltorio de una línea que busca el `statsEntry` y llama a esta. Dos nombres, dos firmas, ninguna ambigüedad.
  - `rolePenaltyFor(positions)` → `number`, donde `positions` es `string[]` (la posición de cada jugador del equipo, `''` si no tiene). Lógica copiada de `useMatchBuilder.js:555+`. El hook mantiene `getTeamRolePenalty(teamIds)` como envoltorio que mapea ids a posiciones.
  - `buildGreedyTeams({ order, pinnedWhite, pinnedBlack, teamSize, scoreOf, positionOf })` → `{ white: string[], black: string[], whiteScore: number, blackScore: number }`. `order` es `string[]` de playerIds ya mezclados; `scoreOf`/`positionOf` son funciones `playerId → number | string`.
  - `evaluateSplit({ whiteIds, blackIds, scoreOf, positionOf, probability })` → `number` (0–100 sin acotar).
  - `pickBestSplit({ pool, pinnedWhite, pinnedBlack, teamSize, scoreOf, positionOf, probabilityOf, iterations, shuffle })` → `{ white, black, score }`. `shuffle` por defecto mezcla con `Math.random`; los tests inyectan una determinista. `iterations` por defecto 40.

- [ ] **Step 1: Añadir el script de test a `package.json`**

```json
"test": "node --test tests/ src/utils/"
```

- [ ] **Step 2: Escribir los tests de equivalencia y de las piezas puras**

En `tests/teamBalancer.test.js`:

```js
test('un jugador sin estadísticas puntúa 50', ...)            // scorePlayer(undefined) === 50
test('el puntaje usa calificación, winrate, mvps y partidos', ...) // valores fijos → número exacto de la fórmula
test('un equipo sin portero penaliza más que uno completo', ...)
test('buildGreedyTeams respeta los jugadores fijados', ...)    // pinned sigue en su equipo
test('buildGreedyTeams es determinista para un orden dado', ...) // mismo order → mismo reparto, dos veces
test('evaluateSplit da el mismo número para los mismos equipos', ...)
test('pickBestSplit con shuffle inyectado no llama a Math.random', ...)
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/utils/teamBalancer.js'`

- [ ] **Step 4: Crear `src/utils/teamBalancer.js` con las cinco funciones**

Copiar las fórmulas desde `useMatchBuilder.js` sin alterarlas. La única diferencia estructural: lo que hoy sale del closure (`statsById`, `matchPositions`, `teamSize`) entra por parámetro, y la aleatoriedad entra como `shuffle`.

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Reescribir los `useCallback` de `useMatchBuilder.js` para delegar al módulo**

Las firmas que el hook expone hacia fuera no cambian (`getPlayerBalanceScore(playerId)`, `getTeamRolePenalty(teamIds)`, `suggestBalancedTeams()`): pasan a ser envoltorios que buscan los datos y llaman al módulo.

**Lo que no puede cambiar:** cuatro cosas consumen estas funciones por dentro —
`playerPowerMap`, `liveDraftInsights`, `generatePollOptions` y `applySwapSuggestion`. En
particular `playerPowerMap` es de donde salen los puntos de color que el admin ve en
pantalla, así que su salida tiene que ser idéntica antes y después del refactor (es el
objetivo O5 del diseño: el algoritmo y la pantalla nunca se contradicen). Verificarlo
comparando los `tier` y `power` de la convocatoria antes y después.

- [ ] **Step 7: Verificar que la app sigue armando equipos igual**

Run: `npm run lint:check && npm run build`
Expected: sin errores. Luego, en el navegador: seleccionar una convocatoria completa, pulsar auto-balance y confirmar que el toast sigue mostrando `diff` y `roles`.

- [ ] **Step 8: Commit**

```bash
git add package.json src/utils/teamBalancer.js tests/teamBalancer.test.js src/hooks/useMatchBuilder.js
git commit -m "refactor(match-builder): extract team balancer into a pure, testable module"
```

---

### Task 2: Restricciones en el balanceador

**Files:**
- Modify: `src/utils/teamBalancer.js`
- Modify: `tests/teamBalancer.test.js`
- Modify: `src/hooks/useMatchBuilder.js` (nuevo parámetro `constraints` en `suggestBalancedTeams`)

**Interfaces:**
- Consumes: `pickBestSplit`, `evaluateSplit` (Tarea 1).
- Produces:
  - `satisfiesConstraints({ white, black, constraints })` → `boolean`.
  - `pickBestSplit` acepta además `constraints` y devuelve `{ white, black, score, constraintsMet: boolean }`. Se queda con el mejor de los `iterations` candidatos que cumpla; si ninguno cumple, devuelve el mejor absoluto con `constraintsMet: false`.
  - Forma de `constraints`: `{ fijarBlanco: string[], fijarNegro: string[], juntar: [string,string][], separar: [string,string][] }`. Campos ausentes = sin restricción.

- [ ] **Step 1: Escribir los tests de restricciones**

```js
test('juntar deja a los dos jugadores en el mismo equipo', ...)
test('separar los deja en equipos distintos', ...)
test('fijarBlanco respeta el equipo pedido', ...)
test('juntar y separar del mismo par es imposible y devuelve constraintsMet false', ...)
test('una restricción imposible devuelve un reparto válido, no una excepción', ...)
test('sin restricciones, el resultado es idéntico al de la tarea 1', ...)
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm test -- --test-name-pattern="restric|juntar|separar|fijar"`
Expected: FAIL

- [ ] **Step 3: Implementar `satisfiesConstraints` y el filtrado dentro de `pickBestSplit`**

Las restricciones entran en dos momentos distintos y confundirlos rompe el resultado:

- **`fijarBlanco` / `fijarNegro` entran como `pinnedWhite` / `pinnedBlack` en la
  generación**, antes de mezclar, para que los `iterations` candidatos los cumplan todos.
  Filtrarlos después descartaría casi todos los candidatos.
- **`juntar` / `separar` se filtran después**: generar los repartos, ordenarlos por
  `evaluateSplit`, devolver el primero que pase `satisfiesConstraints`. Si ninguno pasa,
  el mejor absoluto con `constraintsMet: false`.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Pasar `constraints` desde `suggestBalancedTeams`**

`suggestBalancedTeams({ preserveLockedCaptains, constraints })`. Cuando `constraintsMet` es `false`, el toast existente añade "no se pudo cumplir una restricción".

- [ ] **Step 6: Commit**

```bash
git add src/utils/teamBalancer.js tests/teamBalancer.test.js src/hooks/useMatchBuilder.js
git commit -m "feat(match-builder): support join/split/pin constraints in the balancer"
```

---

### Task 3: El cerebro — prompts, esquema y parseo

**Files:**
- Create: `api/_lib/assistant.js`
- Create: `tests/assistant.test.js`
- Modify: `package.json` (dependencia `@anthropic-ai/sdk`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `MODEL_BY_MODE` → `{ stats: 'claude-haiku-5-5', builder: 'claude-sonnet-5-5' }`
  - `EFFORT_BY_MODE` → `{ stats: 'low', builder: 'medium' }`
  - `MAX_TOKENS_BY_MODE` → `{ stats: 4000, builder: 8000 }`
  - `SYSTEM_BY_MODE` → `{ stats: string, builder: string }`
  - `RESPONSE_SCHEMA` → el esquema de `output_config.format` (§5.5 del diseño: `respuesta` obligatorio, `accion` opcional con `tipo`, `fijarBlanco`, `fijarNegro`, `excluir`, `incluir`, `juntar`, `separar`, `posiciones`, `swap`).
  - `buildRequest({ mode, question, facts, history })` → el objeto completo que se le pasa al SDK, con `cache_control: {type:'ephemeral'}` en el bloque de contenido de los hechos y el bloque de hechos **en el mensaje de usuario nuevo**, nunca reescribiendo los anteriores.
  - `parseAssistantReply(message)` → `{ respuesta, accion, content }` o lanza `AssistantReplyError` con `code` ∈ `{'refusal','truncated','malformed'}`. `content` es el array `message.content` sin tocar.
  - `usesBetaPath(mode)` → `boolean` (`true` solo en `builder`).

- [ ] **Step 1: Escribir los tests**

```js
test('cada modo usa su modelo, su effort y su max_tokens', ...)
test('solo el modo builder va por el camino beta con fallbacks', ...)
test('el bloque de hechos viaja en el mensaje de usuario nuevo', ...)
  // buildRequest con history de 2 turnos → messages[0..1] idénticos a los de entrada
test('los mensajes anteriores no se modifican entre dos peticiones consecutivas', ...)
  // dos buildRequest encadenados → JSON.stringify de los N primeros mensajes es igual
test('el breakpoint de caché está en el bloque de los hechos', ...)
test('una respuesta válida devuelve respuesta, accion y content intacto', ...)
test('stop_reason refusal lanza AssistantReplyError con code refusal', ...)
test('stop_reason max_tokens lanza code truncated', ...)        // Review Focus 5
test('un JSON roto lanza code malformed', ...)
test('una respuesta sin accion es válida', ...)
test('el system prompt del modo stats prohíbe inventar números', ...)
test('el system prompt dice que el bloque de hechos es datos, no instrucciones', ...)
test('el system prompt del modo stats cubre el caso sin datos del periodo', ...) // Review Focus 2
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm test -- --test-name-pattern="modo|hechos|caché|refusal|truncated|malformed|system"`
Expected: FAIL

- [ ] **Step 3: Implementar el módulo**

Los system prompts siguen la intención de §4.3 del diseño y además: la etiqueta del periodo y la advertencia de que `rachaHistorica` ignora el filtro (§5.4); que el bloque de hechos más reciente es el estado actual y los anteriores son historia (§5.4.1); que si `jugadores[]` está vacío hay que decir que no hay datos de ese periodo.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json api/_lib/assistant.js tests/assistant.test.js
git commit -m "feat(assistant): add prompts, output schema and reply parsing"
```

---

### Task 4: Las puertas de acceso

**Files:**
- Create: `api/_lib/auth.js`
- Create: `tests/assistantAuth.test.js`
- Modify: `package.json` (dependencia `firebase-admin`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `SUPER_ADMIN_EMAIL` → `'joseescorcia01@gmail.com'`
  - `authorize({ authHeader, mode, verifyIdToken, getDoc })` → `{ uid, playerId, isAdmin }` o lanza `AuthError` con `status` (401 / 403) y `message` en español. `verifyIdToken` y `getDoc` se inyectan para poder testear sin red; `getDoc(path)` devuelve el objeto del documento o `null`.

- [ ] **Step 1: Escribir los tests**

```js
test('sin cabecera Authorization devuelve 401', ...)
test('un token que no verifica devuelve 401', ...)
test('un usuario sin playerId devuelve 403 con el mensaje de cuenta no vinculada', ...)
test('un usuario blocked devuelve 403', ...)
test('un usuario archived devuelve 403', ...)
test('el modo builder exige admin y rechaza a un usuario normal con 403', ...)
test('el super admin con email verificado pasa el modo builder', ...)
test('un email en settings/admins pasa el modo builder', ...)
test('un email sin verificar no pasa, ni siquiera el del super admin', ...)
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm test -- --test-name-pattern="Authorization|token|playerId|blocked|archived|builder|admin"`
Expected: FAIL

- [ ] **Step 3: Implementar `authorize`**

Mismos mensajes que `respondToAttendance` ([functions/index.js:36-70](../../../functions/index.js)) para que la app hable igual en los dos sitios.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json api/_lib/auth.js tests/assistantAuth.test.js
git commit -m "feat(assistant): add auth and admin gates for the endpoint"
```

---

### Task 5: El cupo diario

**Files:**
- Create: `api/_lib/aiRateLimit.js`
- Create: `tests/aiRateLimit.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `DAILY_LIMITS` → `{ user: 15, admin: 50 }`
  - `reserveQuestion({ uid, isAdmin, runTransaction, today })` → `{ remaining: number }` o lanza `QuotaError` (status 429, mensaje en español). Incrementa dentro de la transacción.
  - `refundQuestion({ uid, runTransaction, today })` → `void`. Nunca baja de 0 y no hace nada si el documento ya cambió de día.

- [ ] **Step 1: Escribir los tests**

```js
test('la primera pregunta del día deja el contador en 1', ...)
test('la segunda pregunta del mismo día deja 2', ...)
test('un día nuevo reinicia el contador a 1', ...)
test('en el tope lanza QuotaError y no incrementa', ...)
test('un admin tiene tope 50', ...)
test('refundQuestion devuelve la pregunta', ...)
test('refundQuestion no baja de cero', ...)
test('refundQuestion no toca un contador de otro día', ...)
test('veinte reservas simultáneas con tope 15 dejan pasar exactamente 15', ...) // Review Focus 3
```

El test de concurrencia usa un doble de `runTransaction` que serializa los callbacks sobre un objeto compartido, igual que lo haría Firestore.

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm test -- --test-name-pattern="contador|tope|refund|simultáneas"`
Expected: FAIL

- [ ] **Step 3: Implementar el módulo**

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/_lib/aiRateLimit.js tests/aiRateLimit.test.js
git commit -m "feat(assistant): add reserve-then-refund daily question quota"
```

---

### Task 6: El endpoint

**Files:**
- Create: `api/assistant.js`
- Modify: `vercel.json`
- Modify: `firestore.rules`
- Modify: `.env.example`
- Modify: `.github/workflows/ci.yml`

**Files (añadidos):**
- Create: `api/_lib/validateBody.js`
- Create: `tests/assistantHandler.test.js`

**Interfaces:**
- Consumes: `authorize` (T4), `reserveQuestion` / `refundQuestion` (T5), `buildRequest` / `parseAssistantReply` / `usesBetaPath` / `MODEL_BY_MODE` (T3).
- Produces:
  - `validateBody(body)` → `{ ok: true, value }` o `{ ok: false, status: 400, error }` (mensaje en español).
  - `POST /api/assistant` → `200 { respuesta, accion, content, remaining }`, o `{ error }` con 400 / 401 / 403 / 405 / 429 / 502.

- [ ] **Step 1: Escribir los tests de validación de entrada**

En `tests/assistantHandler.test.js`:

```js
test('una pregunta vacía se rechaza con 400', ...)
test('una pregunta de 501 caracteres se rechaza', ...)
test('una pregunta de 500 caracteres se acepta', ...)
test('un mode desconocido se rechaza', ...)
test('unos hechos de más de 60 KB se rechazan', ...)
test('un historial de 11 turnos se rechaza', ...)
test('un cuerpo sin facts se rechaza', ...)
```

Es la clase de entrada que un cliente con un bug va a producir, y el único sitio donde
devolver 400 en vez de reventar importa.

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm test -- --test-name-pattern="pregunta|mode|hechos|historial|cuerpo"`
Expected: FAIL

- [ ] **Step 3: Implementar `validateBody` y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Excluir `/api/` del rewrite al SPA en `vercel.json`**

```json
{ "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }] }
```

- [ ] **Step 5: Añadir la regla de lectura de `aiUsage` a `firestore.rules`**

```
match /aiUsage/{userId} {
  allow read: if signedIn() && request.auth.uid == userId;
}
```

El `match /{document=**}` del final ya niega la escritura; la función escribe con el Admin SDK.

- [ ] **Step 6: Escribir el handler**

Orden exacto: método → `authorize` → `validateBody` → `reserveQuestion` → `buildRequest` → SDK (camino beta según el modo) → `parseAssistantReply` → responder. Cualquier fallo después de la reserva llama a `refundQuestion`. `firebase-admin` se inicializa una sola vez por instancia desde `FIREBASE_SERVICE_ACCOUNT`.

- [ ] **Step 7: Documentar los dos secretos en `.env.example`**

Con la advertencia de por qué no llevan prefijo `VITE_`.

- [ ] **Step 8: Añadir `npm test` al CI**

En el job `build` de `.github/workflows/ci.yml`, entre el linter y el build.

- [ ] **Step 9: Verificar que el build sigue limpio**

Run: `npm run lint:check && npm run build && npm test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add api/assistant.js api/_lib/validateBody.js tests/assistantHandler.test.js vercel.json firestore.rules .env.example .github/workflows/ci.yml
git commit -m "feat(assistant): add the /api/assistant endpoint"
```

---

### Task 7: El bloque de hechos y la validación de acciones

**Files:**
- Create: `src/utils/assistantFacts.js`
- Create: `tests/assistantFacts.test.js`

**Interfaces:**
- Consumes: nada (recibe todo por parámetro).
- Produces:
  - `buildStatsFacts({ players, displayStats, matches, ratings, timeFilter, userPlayerId })` → objeto con `periodo`, `jugadores`, `quienPregunta`, `ultimosPartidos` (25), `parejas` (30), `duelos` (30).
  - `buildBuilderFacts(statsFacts, { matchFormat, teamSize, requiredPlayers, selectedPlayers, playerPowerMap, matchPositions, liveDraftInsights })` → `statsFacts` más `formato`, `convocados`, `repartoActual`, `swapsSugeridos`.
  - `validateAssistantAction(accion, { players, selectedPlayers, requiredPlayers, activePlayerIds })` → `{ ok: true, accion }` o `{ ok: false, reason: string }` (razón en español, mostrable).
  - `PERIOD_LABELS` → `{ week: 'la última semana', month: 'este mes', all: 'todo el histórico' }`.

- [ ] **Step 1: Escribir los tests**

```js
test('el periodo refleja el timeFilter activo y trae su etiqueta', ...)
test('los jugadores salen de displayStats, no del histórico completo', ...)
test('cada jugador trae power y tier para que el modelo pueda sugerir sustitutos', ...)
test('la racha va como rachaHistorica porque ignora el filtro', ...)
test('un periodo sin partidos devuelve jugadores vacío sin lanzar', ...)     // Review Focus 2
test('un playerId vinculado a un jugador borrado deja quienPregunta en null sin lanzar', ...) // Review Focus 1
test('ultimosPartidos trae 25 como máximo y en orden cronológico inverso', ...)
test('el bloque serializado de un grupo de 30 jugadores y 300 partidos pesa menos de 60 KB', ...)
test('una acción con un playerId inexistente se rechaza', ...)
test('una acción que deja la convocatoria corta sin incluir se rechaza', ...)
test('excluir mas incluir que mantiene el tamaño se acepta', ...)
test('juntar y separar del mismo par se rechaza', ...)
test('una acción que menciona a alguien que ya no está convocado se rechaza con aviso', ...) // Review Focus 4
test('un swap con un jugador que no está en su equipo se rechaza', ...)
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm test -- --test-name-pattern="periodo|jugadores|racha|quienPregunta|ultimosPartidos|acción|excluir|juntar|swap"`
Expected: FAIL

- [ ] **Step 3: Implementar el módulo**

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/assistantFacts.js tests/assistantFacts.test.js
git commit -m "feat(assistant): build the facts block and validate model actions"
```

---

### Task 8: El hook de conversación

**Files:**
- Create: `src/hooks/useAiAssistant.js`
- Modify: `src/hooks/index.js`

**Interfaces:**
- Consumes: `buildStatsFacts` / `buildBuilderFacts` / `validateAssistantAction` (T7).
- Produces: `useAiAssistant({ mode, facts, showToast })` → `{ messages, ask, loading, error, remaining, quotaExhausted, reset, turnLimitReached }`.
  - `messages`: `{ role, text, accion?, actionError? }[]` para pintar.
  - `ask(question)`: adjunta el ID token (`auth.currentUser.getIdToken()`), hace `fetch('/api/assistant')` con `AbortController` a 120 s, guarda el `content` devuelto **opaco** para reenviarlo tal cual, y valida la acción antes de exponerla.
  - A los 10 turnos, `turnLimitReached` pasa a `true` y `ask` deja de aceptar; `reset()` empieza limpio.

- [ ] **Step 1: Escribir el hook**

Sin tests unitarios propios: es estado de React sobre módulos ya probados (T3, T7) y el proyecto no tiene entorno de test de componentes. Lo cubren los tests de los módulos y la verificación manual de la Tarea 11.

- [ ] **Step 2: Leer `aiUsage/{uid}` para `remaining`**

Suscripción de Firestore, y el valor que devuelve el endpoint tiene prioridad cuando llega — así dos pestañas convergen al número del servidor (Review Focus 3).

- [ ] **Step 3: Verificar que compila**

Run: `npm run lint:check && npm run build`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAiAssistant.js src/hooks/index.js
git commit -m "feat(assistant): add the conversation hook"
```

---

### Task 9: El bot de estadísticas

**Files:**
- Create: `src/components/common/AssistantSheet.jsx`
- Modify: `src/components/common/index.js`
- Modify: `src/App.jsx` (montar el botón flotante y la hoja)
- Create: `src/styles/assistant.css` (o el archivo de estilos que corresponda al patrón vigente)

**Interfaces:**
- Consumes: `useAiAssistant` (T8), `buildStatsFacts` (T7), `FloatingActionButton` y `Modal` existentes.
- Produces: `<AssistantSheet mode open onClose facts chips />`, reutilizable por la Tarea 10.

- [ ] **Step 1: Construir la hoja**

Hilo de mensajes, campo de texto, chips de arranque, contador de preguntas restantes en la cabecera. Estados obligatorios (§6.3): cargando, sin conexión, cupo agotado, cuenta no vinculada, error de la API, respuesta truncada, rechazo de seguridad, tope de turnos. **Ninguno deja la hoja en blanco** (Review Focus 5).

- [ ] **Step 2: Montar el botón flotante en `App.jsx`**

Visible en `stats`, `matches`, `profile` y `analytics`, solo con usuario vinculado.

- [ ] **Step 3: Verificar en el navegador**

Run: `npm run dev`
Abrir la app, pulsar el botón, comprobar que la hoja abre, que el contador aparece y que con el campo vacío no se puede enviar.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/AssistantSheet.jsx src/components/common/index.js src/App.jsx src/styles/
git commit -m "feat(assistant): add the stats chat sheet for all members"
```

---

### Task 10: El asistente del armador

**Files:**
- Create: `src/components/matchday/BuilderAssistantPanel.jsx`
- Modify: `src/components/tabs/MatchBuilderTab.jsx`
- Modify: `src/hooks/useMatchBuilder.js` (`applyAssistantAction`)

**Interfaces:**
- Consumes: `AssistantSheet` (T9), `buildBuilderFacts` (T7), `suggestBalancedTeams` con `constraints` (T2).
- Produces: `applyAssistantAction(accion)` en el retorno de `useMatchBuilder`. Pasa por `pushUndo('Asistente')`, aplica `excluir`/`incluir` con `handlePoolPlayerToggle`, las posiciones con el setter existente, y después llama a `suggestBalancedTeams({ constraints })` o al swap según `accion.tipo`.

- [ ] **Step 1: Implementar `applyAssistantAction` dentro del hook**

Dentro, no exportando `pushUndo`: el hook sigue siendo dueño de su historial de deshacer.

- [ ] **Step 2: Construir el panel y la tarjeta de propuesta**

Panel plegable, cerrado por defecto, debajo de los insights. La tarjeta muestra qué cambia, quién sale y quién entra, el balance antes y después según el balanceador, y los botones **Aplicar** y **Descartar**.

- [ ] **Step 3: Verificar el deshacer**

Aplicar una propuesta y comprobar que el botón de deshacer vuelve al estado anterior.

- [ ] **Step 4: Verificar que el build sigue limpio**

Run: `npm run lint:check && npm run build && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/matchday/BuilderAssistantPanel.jsx src/components/tabs/MatchBuilderTab.jsx src/hooks/useMatchBuilder.js
git commit -m "feat(match-builder): add the AI assistant panel with applyable proposals"
```

---

### Task 11: Verificación contra la API real

Requiere los dos secretos cargados en Vercel y la key rotada (§10 del diseño).

- [ ] **Step 1: Desplegar una preview**

```bash
git push -u origin HEAD
```

Vercel genera una URL de preview con la función desplegada.

- [ ] **Step 2: Probar el bot de estadísticas**

Tres preguntas, una de ellas con el filtro en "mes". Confirmar que los números coinciden con la tabla en pantalla y que la respuesta nombra el periodo.

- [ ] **Step 3: Probar el modo armado con diez órdenes reales**

"sin los que faltaron", "juntá a los hermanos", "separá a los dos mejores", "revancha del domingo", una imposible, una ambigua, y cuatro más del uso real. Anotar cuántas traduce bien: es el dato que decide si `claude-sonnet-5-5` se queda o hay que subir a `claude-opus-5-5` (§4.4).

- [ ] **Step 4: Medir el costo real**

Loguear `usage` de cada llamada. Confirmar `cache_read_input_tokens > 0` en la segunda pregunta de una conversación, y comparar el costo por pregunta con las estimaciones de §4.2.

- [ ] **Step 5: Probar el cupo**

Agotar el cupo de una cuenta de prueba y confirmar que el campo se deshabilita con el mensaje del servidor.

- [ ] **Step 6: Commit de los ajustes que salgan de la prueba**

```bash
git commit -m "fix(assistant): adjust prompts and copy after live verification"
```
