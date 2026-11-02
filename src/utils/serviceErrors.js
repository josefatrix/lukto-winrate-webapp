export const isQuotaError = error =>
  String(error?.code || '').includes('resource-exhausted') ||
  /quota exceeded|quota limit exceeded/i.test(error?.message || '')

export const QUOTA_MESSAGE =
  'El club alcanzó el límite diario gratuito de datos. Es posible que los datos guardados sigan visibles, pero las calificaciones, predicciones y cambios estarán temporalmente no disponibles hasta que el límite se reinicie. No se requiere ningún pago.'

export const describeServiceError = (error, fallback) =>
  isQuotaError(error) ? QUOTA_MESSAGE : fallback
