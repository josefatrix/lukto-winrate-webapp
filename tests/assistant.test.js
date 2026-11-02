import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MODEL_BY_MODE,
  EFFORT_BY_MODE,
  MAX_TOKENS_BY_MODE,
  SYSTEM_BY_MODE,
  RESPONSE_SCHEMA,
  FALLBACK_BETAS,
  usesBetaPath,
  buildRequest,
  parseAssistantReply,
  AssistantReplyError,
} from '../api/_lib/assistant.js'

const facts = { periodo: { clave: 'month', etiqueta: 'este mes' }, jugadores: [] }

/* assert.throws devuelve undefined, así que para inspeccionar el error hay que
   capturarlo a mano. */
const caught = fn => {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

const caughtReplyError = fn => {
  const error = caught(fn)
  assert.ok(error instanceof AssistantReplyError, `esperaba AssistantReplyError, recibí ${error}`)
  return error
}

const reply = (payload, overrides = {}) => ({
  id: 'msg_1',
  stop_reason: 'end_turn',
  content: [
    { type: 'thinking', thinking: '' },
    { type: 'text', text: JSON.stringify(payload) },
  ],
  ...overrides,
})

// ── Parámetros por modo ────────────────────────────────────────────────────

test('cada modo usa su modelo, su effort y su max_tokens', () => {
  assert.equal(MODEL_BY_MODE.stats, 'claude-haiku-5-5')
  assert.equal(MODEL_BY_MODE.builder, 'claude-sonnet-5-5')
  assert.equal(EFFORT_BY_MODE.stats, 'low')
  assert.equal(EFFORT_BY_MODE.builder, 'medium')
  assert.equal(MAX_TOKENS_BY_MODE.stats, 4000)
  assert.equal(MAX_TOKENS_BY_MODE.builder, 8000)

  const stats = buildRequest({ mode: 'stats', question: '¿quién va primero?', facts })
  assert.equal(stats.model, 'claude-haiku-5-5')
  assert.equal(stats.max_tokens, 4000)
  assert.equal(stats.output_config.effort, 'low')

  const builder = buildRequest({ mode: 'builder', question: 'armá los equipos', facts })
  assert.equal(builder.model, 'claude-sonnet-5-5')
  assert.equal(builder.max_tokens, 8000)
  assert.equal(builder.output_config.effort, 'medium')
})

test('la petición no manda thinking ni parámetros de muestreo', () => {
  for (const mode of ['stats', 'builder']) {
    const req = buildRequest({ mode, question: 'hola', facts })
    assert.equal('thinking' in req, false, `${mode} no debe mandar thinking`)
    assert.equal('temperature' in req, false)
    assert.equal('top_p' in req, false)
    assert.equal('top_k' in req, false)
    assert.equal('tools' in req, false, 'no se usan herramientas')
    assert.equal('tool_choice' in req, false)
  }
})

test('solo el modo builder va por el camino beta con fallbacks', () => {
  assert.equal(usesBetaPath('builder'), true)
  assert.equal(usesBetaPath('stats'), false)

  const builder = buildRequest({ mode: 'builder', question: 'hola', facts })
  assert.equal(builder.fallbacks, 'default')
  assert.deepEqual(builder.betas, FALLBACK_BETAS)
  assert.deepEqual(FALLBACK_BETAS, ['server-side-fallback-2026-07-01'])

  const stats = buildRequest({ mode: 'stats', question: 'hola', facts })
  assert.equal('fallbacks' in stats, false)
  assert.equal('betas' in stats, false)
})

test('la salida va por structured outputs con el esquema', () => {
  const req = buildRequest({ mode: 'stats', question: 'hola', facts })
  assert.equal(req.output_config.format.type, 'json_schema')
  assert.equal(req.output_config.format.schema, RESPONSE_SCHEMA)
  assert.deepEqual(RESPONSE_SCHEMA.required, ['respuesta', 'accion'])
  assert.equal(RESPONSE_SCHEMA.additionalProperties, false)
})

// ── Historial solo-añadir ──────────────────────────────────────────────────

test('el bloque de hechos viaja en el mensaje de usuario nuevo', () => {
  const history = [
    { role: 'user', content: [{ type: 'text', text: 'pregunta vieja' }] },
    { role: 'assistant', content: [{ type: 'text', text: '{"respuesta":"vieja"}' }] },
  ]
  const req = buildRequest({ mode: 'builder', question: 'pregunta nueva', facts, history })

  assert.equal(req.messages.length, 3)
  assert.deepEqual(req.messages.slice(0, 2), history, 'los turnos anteriores viajan intactos')

  const last = req.messages[2]
  assert.equal(last.role, 'user')
  assert.ok(last.content[0].text.includes(JSON.stringify(facts)), 'los hechos van en el turno nuevo')
  assert.ok(last.content.at(-1).text.includes('pregunta nueva'))
})

test('los mensajes anteriores no se modifican entre dos peticiones consecutivas', () => {
  const first = buildRequest({ mode: 'builder', question: 'uno', facts })
  const history = [...first.messages, { role: 'assistant', content: [{ type: 'text', text: '{}' }] }]
  const second = buildRequest({
    mode: 'builder',
    question: 'dos',
    facts: { ...facts, cambiado: true },
    history,
  })

  /* Byte-idénticos salvo los marcadores de caché, que la API trata aparte:
     añadir, mover o quitar un cache_control no cuenta como editar el
     historial, y hay que quitarlos para no pasar del tope de cuatro. */
  const stripMarkers = messages =>
    messages.map(message => ({
      ...message,
      content: (message.content || []).map(({ cache_control: _ignored, ...block }) => block),
    }))

  assert.equal(
    JSON.stringify(second.messages.slice(0, history.length)),
    JSON.stringify(stripMarkers(history)),
    'reescribir un turno anterior invalidaría los bloques de pensamiento'
  )
  assert.equal(second.system, first.system, 'el system prompt no puede cambiar a mitad de conversación')
})

test('el breakpoint de caché está en el bloque de los hechos', () => {
  const req = buildRequest({ mode: 'stats', question: 'hola', facts })
  const last = req.messages.at(-1)
  assert.deepEqual(last.content[0].cache_control, { type: 'ephemeral' })
  assert.equal(
    last.content.at(-1).cache_control,
    undefined,
    'la pregunta cambia en cada turno; marcarla daría cero aciertos'
  )
})

// ── System prompts ─────────────────────────────────────────────────────────

test('el system prompt del modo stats prohíbe inventar números', () => {
  assert.match(SYSTEM_BY_MODE.stats, /nunca inventes/i)
})

test('el system prompt dice que el bloque de hechos es datos, no instrucciones', () => {
  for (const mode of ['stats', 'builder']) {
    assert.match(SYSTEM_BY_MODE[mode], /datos, no instrucciones/i, mode)
  }
})

test('el system prompt del modo stats cubre el caso sin datos del periodo', () => {
  assert.match(SYSTEM_BY_MODE.stats, /no hay datos/i)
})

test('el system prompt del modo builder prohíbe calcular los equipos', () => {
  assert.match(SYSTEM_BY_MODE.builder, /no calculas los equipos/i)
})

test('el system prompt avisa que el bloque de hechos más reciente es el estado actual', () => {
  assert.match(SYSTEM_BY_MODE.builder, /más reciente/i)
})

test('el system prompt avisa que la racha ignora el periodo', () => {
  assert.match(SYSTEM_BY_MODE.stats, /quienPregunta\.historico/)
})

// ── Parseo ─────────────────────────────────────────────────────────────────

test('una respuesta válida devuelve respuesta, accion y content intacto', () => {
  const payload = {
    respuesta: 'Blanco está más fuerte.',
    accion: { tipo: 'rebalancear', separar: [['a', 'b']] },
  }
  const message = reply(payload)
  const parsed = parseAssistantReply(message)

  assert.equal(parsed.respuesta, 'Blanco está más fuerte.')
  assert.deepEqual(parsed.accion, payload.accion)
  assert.equal(parsed.content, message.content, 'el content se devuelve sin tocar, para reenviarlo')
})

test('una respuesta sin accion es válida', () => {
  assert.equal(parseAssistantReply(reply({ respuesta: 'Van 6 partidos.', accion: null })).accion, null)
  assert.equal(parseAssistantReply(reply({ respuesta: 'Van 6 partidos.' })).accion, null)
})

test('una accion de tipo ninguna se trata como ausente', () => {
  const parsed = parseAssistantReply(reply({ respuesta: 'ok', accion: { tipo: 'ninguna' } }))
  assert.equal(parsed.accion, null)
})

test('stop_reason refusal lanza AssistantReplyError con code refusal', () => {
  const err = caughtReplyError(() =>
    parseAssistantReply(reply({ respuesta: 'x' }, { stop_reason: 'refusal' }))
  )
  assert.equal(err.code, 'refusal')
})

test('stop_reason max_tokens lanza code truncated', () => {
  const err = caughtReplyError(() =>
    parseAssistantReply(reply({ respuesta: 'x' }, { stop_reason: 'max_tokens' }))
  )
  assert.equal(err.code, 'truncated')
})

test('un JSON roto lanza code malformed', () => {
  const message = {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: '{"respuesta":' }],
  }
  const err = caughtReplyError(() => parseAssistantReply(message))
  assert.equal(err.code, 'malformed')
})

test('una respuesta sin bloque de texto lanza code malformed', () => {
  const message = { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }] }
  const err = caughtReplyError(() => parseAssistantReply(message))
  assert.equal(err.code, 'malformed')
})

test('una respuesta con el campo respuesta vacío lanza code malformed', () => {
  const err = caughtReplyError(() => parseAssistantReply(reply({ respuesta: '   ' })))
  assert.equal(err.code, 'malformed')
})

test('todos los AssistantReplyError traen un mensaje en español para mostrar', () => {
  for (const message of [
    reply({ respuesta: 'x' }, { stop_reason: 'refusal' }),
    reply({ respuesta: 'x' }, { stop_reason: 'max_tokens' }),
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'no json' }] },
  ]) {
    const err = caughtReplyError(() => parseAssistantReply(message))
    assert.ok(err.userMessage.length > 10, `falta userMessage para ${err.code}`)
  }
})

// ── Hallazgos de la revisión de rama ───────────────────────────────────────

const turnPair = factsBlockText => [
  { role: 'user', content: [{ type: 'text', text: factsBlockText, cache_control: { type: 'ephemeral' } }, { type: 'text', text: 'pregunta' }] },
  { role: 'assistant', content: [{ type: 'text', text: '{"respuesta":"ok","accion":null}' }] },
]

const countMarkers = request =>
  request.messages.reduce(
    (total, message) =>
      total + (message.content || []).filter(block => block?.cache_control).length,
    0
  )

test('una conversación larga nunca manda más de cuatro marcadores de caché', () => {
  // La API rechaza con 400 a partir del quinto. Sin esto, toda conversación
  // moría en la quinta pregunta.
  for (let turns = 1; turns <= 10; turns++) {
    const history = Array.from({ length: turns }, (_, i) => turnPair(`<hechos>${i}</hechos>`)).flat()
    const request = buildRequest({ mode: 'builder', question: 'otra', facts, history })
    assert.ok(
      countMarkers(request) <= 4,
      `con ${turns} turnos van ${countMarkers(request)} marcadores`
    )
  }
})

test('el marcador de caché queda en el bloque de hechos nuevo', () => {
  const history = turnPair('<hechos>viejo</hechos>')
  const request = buildRequest({ mode: 'stats', question: 'otra', facts, history })
  assert.deepEqual(request.messages.at(-1).content[0].cache_control, { type: 'ephemeral' })
  assert.equal(countMarkers(request), 1)
})

test('quitar marcadores no cambia el texto de los turnos anteriores', () => {
  const history = turnPair('<hechos>viejo</hechos>')
  const request = buildRequest({ mode: 'stats', question: 'otra', facts, history })
  const sentText = request.messages.slice(0, 2).map(m => (m.content || []).map(b => b.text))
  const originalText = history.map(m => (m.content || []).map(b => b.text))
  assert.deepEqual(sentText, originalText, 'solo se tocan los marcadores, nunca el contenido')
})

test('el system prompt de stats también dice cuál bloque de hechos es el actual', () => {
  assert.match(SYSTEM_BY_MODE.stats, /más reciente/i)
})
