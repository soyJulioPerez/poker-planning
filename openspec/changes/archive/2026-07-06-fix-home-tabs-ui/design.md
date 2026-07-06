## Context

`Home` (`apps/web/src/app/pages/home/`) usa un signal `mode` (`'create' | 'join'`) para alternar entre dos formularios, presentados como tabs. El estilo actual de la tab activa (`.home__tab--active`) define `background: #1a1a1a; color: white;`, pero pruebas manuales muestran que el texto de la tab seleccionada no se distingue del fondo. Además, `mode` inicia en `'create'`, mostrando "Crear sala" por defecto, aunque la mayoría de los usuarios llegan a la app con un link de sala para unirse.

## Goals / Non-Goals

**Goals:**
- Que el texto de la tab seleccionada sea siempre legible (contraste correcto).
- Que "Unirse a sala" sea la tab activa por defecto al cargar `Home`.

**Non-Goals:**
- No se rediseña el layout general de `Home` ni el resto de los formularios.
- No se modifica el comportamiento funcional de crear/unirse a sala (cubierto por `room-management`).

## Decisions

- **Valor inicial del signal `mode`**: cambiar `signal<Mode>('create')` a `signal<Mode>('join')` en `home.ts`. Es el cambio mínimo y no afecta el resto del flujo, que ya depende de `mode()` para decidir el formulario visible.
- **Contraste del texto en la tab activa**: revisar y ajustar `.home__tabs button` / `.home__tab--active` en `home.scss` para asegurar que el color de texto tenga contraste suficiente contra el fondo en ambos estados (activo e inactivo). Se investigará en la etapa de implementación si el problema es la ausencia de `color` explícito en el botón base (herencia inesperada) o un valor de `color` mal aplicado en `--active`; la corrección se hace directamente en las reglas existentes, sin introducir nuevas clases.

## Risks / Trade-offs

- [Cambiar el default a "join"] → usuarios que abren la app sin link (para crear una sala nueva) verán un clic extra para cambiar de tab. Mitigación: es un cambio de un clic, y se prioriza el caso de uso más común (unirse vía link).
- [Ajuste de estilos] → riesgo bajo de romper el estilo visual de la tab inactiva al tocar las reglas compartidas. Mitigación: validar visualmente ambos estados (activo/inactivo) tras el cambio.
