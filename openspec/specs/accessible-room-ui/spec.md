# accessible-room-ui Specification

## Purpose
TBD - created by archiving change fix-room-ui-accessibility. Update Purpose after archive.
## Requirements
### Requirement: Toda acción disponible con mouse lo está con teclado

Cualquier elemento de la interfaz de sala que dispare una acción al hacer clic SHALL ser alcanzable con `Tab` y activable con `Enter` y `Space`. No SHALL existir ninguna función del producto que requiera un dispositivo señalador.

Esto no es una preferencia de marcado: es la condición para que las capabilities ya especificadas —en particular la resolución manual de la historia de `estimation-session`— se cumplan para todas las personas usuarias.

#### Scenario: El moderador resuelve una historia sin usar el mouse

- **WHEN** el moderador, tras el revelado, navega con `Tab` hasta el voto de un participante y presiona `Enter`
- **THEN** el sistema asigna ese valor como puntuación definitiva de la historia actual, igual que al hacer clic

#### Scenario: El voto seleccionable recibe foco visible

- **WHEN** el moderador navega con `Tab` por el panel de votos revelados
- **THEN** cada voto seleccionable recibe el foco y lo muestra de forma perceptible visualmente

#### Scenario: Los votos no seleccionables no capturan el foco

- **WHEN** el revelado incluye votos no numéricos, o quien mira no es el moderador
- **THEN** esos votos no reciben foco al navegar con `Tab`, porque no disparan ninguna acción

#### Scenario: El linter no reporta violaciones de interacción

- **WHEN** se ejecuta `nx lint web`
- **THEN** no se reporta ningún error de `@angular-eslint/template/click-events-have-key-events` ni de `@angular-eslint/template/interactive-supports-focus`

### Requirement: Los controles cuyo emoji hace de etiqueta tienen nombre accesible en español

Todo control interactivo cuyo emoji o símbolo visible **funcione como etiqueta de una acción** SHALL declarar un `aria-label` en español que describa esa acción.

El `title` no alcanza: en el cálculo del accessible name, el contenido de texto tiene prioridad sobre `title`, así que un botón `<button title="Nueva ronda">↻</button>` se anuncia como "↻".

**La distinción es entre emoji-etiqueta y emoji-contenido**, y determina qué controles quedan cubiertos:

| El emoji es… | Ejemplos | Tratamiento |
|---|---|---|
| **Etiqueta** de una acción que el emoji no comunica | `↻` nueva ronda, `💡` guía | `aria-label` requerido |
| **Contenido** que el usuario elige o compara | cartas `☕` `🧉` `?`, íconos del picker | Sin `aria-label`: el lector anuncia el emoji, y quien ve la pantalla tampoco recibe más información que eso |

Las cartas del mazo y los íconos de participante quedan **fuera** de este requirement a propósito. Un `aria-label="Ícono 🐶"` haría que se anuncie *"Ícono cara de perro"*, peor que dejar que el lector lea el emoji solo. Y una carta `☕` significa "necesito un descanso" tanto para quien la ve como para quien la escucha: la ambigüedad es del diseño del mazo, no de la accesibilidad, y se resuelve en la guía de estimación, no con ARIA.

#### Scenario: El botón de nueva ronda se anuncia por su función

- **WHEN** un lector de pantalla —o un selector por rol y nombre— busca el control de nueva ronda del panel de revelado
- **THEN** lo encuentra por el nombre accesible "Nueva ronda", no por el carácter "↻"

#### Scenario: Un test e2e puede ubicar el control por su rol y nombre

- **WHEN** un test de Playwright usa `getByRole('button', { name: 'Nueva ronda' })`
- **THEN** el control se encuentra, sin necesidad de recurrir a un selector por clase CSS

### Requirement: Los elementos decorativos no interactivos se anuncian o se ocultan, según su aporte

Un elemento no interactivo cuyo contenido visible sea un emoji SHALL declarar explícitamente su intención accesible: si aporta información, expone un nombre en español; si duplica información ya presente en el texto adyacente, se oculta de la accesibilidad.

Lo que no es aceptable es dejarlo sin decidir: un emoji suelto se anuncia con su nombre Unicode en el idioma del lector, que rara vez coincide con lo que significa en el producto.

#### Scenario: La insignia de moderador se anuncia por su significado

- **WHEN** un lector de pantalla recorre la lista de participantes y encuentra la insignia de moderador
- **THEN** la anuncia como "Moderador", no como la descripción Unicode del emoji "🧙"

#### Scenario: El ícono del participante no duplica el nombre

- **WHEN** un lector de pantalla recorre un participante que eligió un ícono
- **THEN** anuncia el nombre del participante una sola vez, sin agregar una lectura del emoji que no aporta información nueva

### Requirement: El estado de selección se comunica por ARIA, no solo por color

Todo control que represente una opción seleccionable dentro de un conjunto SHALL comunicar su estado mediante `aria-pressed`, además de la señal visual.

Un estado que existe únicamente como clase CSS es invisible para quien no ve la pantalla, y también para los tests que consultan por rol y estado.

Alcanza a los dos conjuntos de opciones del producto: **las cartas del mazo** y **la grilla de selección de ícono**. Se usa `aria-pressed` y no `role="radio"` + `aria-checked` porque los controles ya son `<button>` y el patrón de radiogroup exigiría además manejar navegación por flechas y foco compuesto — mayor superficie de cambio sin beneficio proporcional en un conjunto plano de botones.

#### Scenario: La carta votada se anuncia como elegida

- **WHEN** una persona vota una carta y recorre el mazo con un lector de pantalla
- **THEN** la carta votada se anuncia como presionada
- **AND** las demás se anuncian como no presionadas

#### Scenario: El ícono elegido se anuncia como seleccionado

- **WHEN** una persona navega la grilla de selección de ícono con un lector de pantalla
- **THEN** el botón del ícono actualmente elegido se anuncia como seleccionado
- **AND** los demás se anuncian como no seleccionados

#### Scenario: Los tabs quedan fuera de este requirement

Los tabs de la home (`Unirse` / `Crear sala`) y los de la guía de estimación también expresan su estado solo por CSS, pero **no** se resuelven con `aria-pressed`: su patrón correcto es `role="tablist"` / `role="tab"` con `aria-selected`, que implica manejo de foco y navegación por flechas.

- **WHEN** se audita el estado de selección de los tabs
- **THEN** se los trata como un problema aparte, registrado en `docs/known-issues.md`, y no se los parcha con `aria-pressed`

### Requirement: El comportamiento existente no cambia

Este change SHALL ser puramente de capa de presentación. Los `output()` de los componentes, los mensajes de WebSocket y la lógica de resolución SHALL quedar intactos.

Cambia **cómo se dispara** una acción, no **qué acción se dispara** ni quién puede dispararla.

#### Scenario: Las reglas de permiso siguen vigentes

- **WHEN** un participante que no es moderador visualiza el panel de votos revelados
- **THEN** no puede resolver la historia, ni con mouse ni con teclado

#### Scenario: Los tests existentes siguen pasando

- **WHEN** se ejecuta la suite de tests unitarios y e2e tras el cambio
- **THEN** pasa sin modificaciones de comportamiento esperado, salvo los selectores que se migren deliberadamente a `getByRole`

