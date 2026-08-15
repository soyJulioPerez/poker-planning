# Diseño — Los logs dejan de acumularse para siempre

## Context

```
   Function (physical ID cambia en cada reemplazo)
     │
     └─▶ LogGroup auto-creado por Lambda
         nace atado al ID de la función
         reemplazo de la función → el viejo queda huérfano
         retención por default de CloudWatch: infinita
```

Verificado el 2026-08-14, antes de escribir esto:

| | |
|---|---|
| `retentionInDays` en los 3 log groups activos de `dev` | `None` (nunca expira) |
| Log groups totales en `dev` | 12 — solo 3 pertenecían al stack activo |
| Log groups en `qa` | 0 — las 3 Lambdas de `qa` nunca se invocaron (el log group nace en la primera invocación, no en el deploy) |
| Log groups en `prod` | 3 — coinciden exactamente con las 3 funciones activas, sin huérfanos todavía |
| Valores válidos de `RetentionInDays` | `[1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, ...]` — confirmado contra la API real (`put-retention-policy` con `20` rechazado con `InvalidParameterException`, listando el enum) |

Los 9 huérfanos de `dev` ya se borraron a mano. `qa` y `prod` no necesitaron esa limpieza puntual — pero el mecanismo que los generaría en el futuro está intacto en los tres.

## Goals / Non-Goals

**Goals:**

- Que ningún log group de `realtime-api` retenga para siempre.
- Que un reemplazo de función futuro no vuelva a dejar un log group huérfano.
- Que el nombre del log group sea predecible, sin depender de `describe-stack-resource`.
- Tratar el historial real de `prod` con más cuidado que el de `dev`/`qa`.

**Non-Goals:**

- **`LogFormat` / `ApplicationLogLevel` / `SystemLogLevel`.** Son las otras propiedades de Advanced Logging Controls, a nivel de plataforma. Powertools ya resuelve el formato JSON a nivel de aplicación; no hay necesidad identificada de tocar esto todavía.
- **Adoptar los log groups auto-generados actuales** en vez de crear unos nuevos. Ver Decisión 2.
- **Alarmas y tracing** — Fases 4.2 y 4.3.

## Decisions

### Decisión 1: el log group se declara como recurso propio, no se deja auto-generar

SAM no tiene un atajo de "solo retención" para funciones `AWS::Serverless::Function`. La única forma de controlar `RetentionInDays` es declarar el `AWS::Logs::LogGroup` explícitamente y apuntar la función a él con `LoggingConfig.LogGroup`.

**Elegido**: un `AWS::Logs::LogGroup` por función, con nombre fijo:

```yaml
ConnectLogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: !Sub '/aws/lambda/poker-planning-${Environment}-connect'
    RetentionInDays: !FindInMap [LogRetention, !Ref Environment, Days]

ConnectFunction:
  Type: AWS::Serverless::Function
  Properties:
    LoggingConfig:
      LogGroup: !Ref ConnectLogGroup
    ...
```

`LoggingConfig` es una propiedad mutable de Lambda (Advanced Logging Controls, 2023): cambiarla actualiza la configuración de la función in-place, no la reemplaza. Este cambio no genera un huérfano por sí mismo — el que se generó es la transición de un nombre a otro (Decisión 2), un evento de una sola vez.

**Por qué resuelve retención y huérfanos con el mismo movimiento**: al ser un recurso del stack con nombre fijo —no atado al ID físico de la función—, el log group sobrevive a un reemplazo futuro de la función. CloudFormation lo sigue gestionando; la función nueva sigue escribiendo ahí. El mecanismo que generó los 9 huérfanos de `dev` deja de existir, no solo se les pone fecha de vencimiento a los que ya hay.

### Decisión 2: nombre nuevo y fijo, no adoptar el log group auto-generado actual

Se consideró declarar el `AWS::Logs::LogGroup` con el `LogGroupName` que las funciones activas ya usan hoy (`poker-planning-dev-DefaultFunction-4mz84LLMk0bE`, etc.), para no generar ninguna transición.

**Descartado**: CloudFormation no puede "adoptar" un recurso que ya existe fuera de su gestión declarándolo de nuevo — intentar crear un `AWS::Logs::LogGroup` con un nombre que ya existe falla con `ResourceAlreadyExistsException`. Adoptarlo de verdad requiere un `import` de CloudFormation, una operación de otra categoría de riesgo para el beneficio que da acá. Y aunque se lograra, el nombre seguiría atado al ID físico actual — el próximo reemplazo de la función volvería a dejarlo huérfano, sin resolver la causa.

**Elegido**: nombre nuevo y estable, en la misma convención que ya usa el resto del template — `poker-planning-rooms-${Environment}` (tabla), `poker-planning-ws-${Environment}` (API), y ahora `poker-planning-${Environment}-connect` (log group). Efecto colateral bueno: la sección *"Encontrar el log group correcto"* de `aws-observability.md` deja de necesitar `describe-stack-resource` — el nombre se puede escribir directo.

**Costo aceptado**: una transición de una sola vez por ambiente (Decisión 3).

### Decisión 3: la transición se trata distinto en `prod` que en `dev`/`qa`

Al desplegar este cambio, la función pasa a escribir en el log group nuevo. El log group auto-generado que usaba hasta ese momento deja de recibir escritura y queda huérfano — el mismo problema que este change existe para resolver, pero una última vez, inevitable en la transición misma.

```
              dev / qa                              prod
   ────────────────────────────────    ────────────────────────────────
   contenido: datos de prueba,          contenido: actividad real de
   ya limpiado una vez                  producción, nunca revisado
        │                                        │
        ▼                                        ▼
   borrar directo                       fijar retención (14 días,
   (mismo criterio que ya                igual que la nueva) y dejar
   se aplicó el 2026-08-14)              que expire solo
```

**Elegido**: en `dev` y `qa`, borrar el huérfano transicional directamente — es descartable, y `dev` ya pasó por esta limpieza una vez. En `prod`, **no borrar**: fijarle `RetentionInDays: 14` con `put-retention-policy` y dejar que expire naturalmente. Preserva dos semanas de historial real por si hace falta investigar algo que pasó antes de este cambio, sin comprometerse a retenerlo para siempre.

**Alternativa descartada — borrar también el de `prod`**: es lo más simple, pero destruye de un saque todo el historial de producción acumulado hasta ahora, sin necesidad. El costo de no hacerlo es cero — el log group vacío, una vez expirado su contenido, no cuesta nada mantener.

### Decisión 4: retención por ambiente, vía `Mappings`

**Elegido**:

```yaml
Mappings:
  LogRetention:
    dev:  { Days: 7 }
    qa:   { Days: 7 }
    prod: { Days: 14 }
```

Referenciado como `!FindInMap [LogRetention, !Ref Environment, Days]`. Mismo criterio de diferenciación por ambiente que ya usa el roadmap para las alarmas de la Fase 4.2 (*"o dev genera spam"*): `dev`/`qa` son ruido de corto plazo, `prod` necesita algo más de margen para investigar un incidente después de que alguien lo reporte.

**`Globals` no sirve para esto**: `Globals` en SAM solo aplica a tipos `AWS::Serverless::*`, no a recursos nativos como `AWS::Logs::LogGroup`. Los tres recursos se repiten explícitamente, igual que ya se repite `Metadata.BuildProperties` tres veces en el template actual.

## Risks / Trade-offs

**[El deploy no actualiza `LoggingConfig` como se espera]** → Es una propiedad documentada como mutable, pero se verifica con un deploy real a `dev` antes de tocar `qa`/`prod`.

**[Se pierde historial de `prod` sin querer]** → Es el riesgo que la Decisión 3 existe para evitar. La secuencia de tareas pone `prod` al final, después de confirmar en `dev` que el mecanismo funciona como se espera.

**[El huérfano transicional de `prod` con retención puesta igual desaparece antes de lo esperado]** → `RetentionInDays` purga de inmediato todo lo que ya sea más viejo que el umbral al momento de fijarlo. Si el historial de `prod` ya tiene más de 14 días de antigüedad en su mayoría, gran parte se pierde igual en el momento de fijar la retención, no de forma gradual. Se acepta: es preferible a borrarlo entero, y es el mismo comportamiento que tendrá el log group nuevo de ahí en adelante.

## Migration Plan

1. `Mappings.LogRetention` en `infra/template.yaml`.
2. Los tres `AWS::Logs::LogGroup`, con nombre fijo y `RetentionInDays` desde el mapping.
3. `LoggingConfig.LogGroup` en las tres funciones.
4. Deploy a `dev` (confirmar antes). Verificar que las nuevas invocaciones escriben en el log group nuevo.
5. Limpieza en `dev`: borrar los 3 huérfanos transicionales.
6. Deploy a `qa` (confirmar antes). Sin huérfanos que limpiar — nunca tuvo logs.
7. Deploy a `prod` (confirmar antes). Fijar `RetentionInDays: 14` en el huérfano transicional, **no borrarlo**.
8. Actualizar `aws-observability.md` con el nombre fijo del log group.

**Rollback**: revertir el commit. Los log groups nuevos quedan (CloudFormation no los borra al hacer rollback de un commit de git, solo al hacer rollback del stack); no tienen costo relevante vacíos y con retención puesta.

## Open Questions

Ninguna de alcance. Los tres números de retención están decididos.
