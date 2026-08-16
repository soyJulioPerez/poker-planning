## ADDED Requirements

### Requirement: El deploy a `prod` se verifica con un smoke test funcional

El sistema SHALL ejecutar, después de desplegar `realtime-api` al ambiente `prod`, una prueba funcional real contra el endpoint recién desplegado: conectar por WebSocket, crear una sala, unir un segundo participante, votar y revelar. Un fallo en esa secuencia SHALL dejar el job de deploy en rojo.

Esta verificación SHALL correr únicamente contra `prod` — no contra `qa` ni `dev`.

#### Scenario: Un endpoint roto deja el deploy a prod en rojo

- **WHEN** el smoke test no logra completar la secuencia crear/unir/votar/revelar contra el endpoint de `prod` recién desplegado
- **THEN** el job de deploy termina en rojo, aunque `sam deploy` haya terminado exitosamente

#### Scenario: El smoke test no corre contra `qa`

- **WHEN** se despliega `realtime-api` a `qa` (push a una rama `release/**`, o `workflow_dispatch` manual con `environment: qa`)
- **THEN** el smoke test no se ejecuta

### Requirement: El smoke test no deja datos huérfanos en la tabla real

El sistema SHALL eliminar explícitamente, al finalizar el smoke test (haya pasado o fallado), todos los items de DynamoDB que creó — sin depender de `closeRoom` (que no borra datos, solo notifica) ni del TTL de la sala (4 horas, demasiado largo para una sala de prueba generada en cada deploy).

#### Scenario: Los datos de prueba se limpian aunque el smoke test falle

- **WHEN** el smoke test crea una sala y participantes, y luego alguna aserción de la secuencia falla
- **THEN** los items de esa sala y sus participantes igual se eliminan de la tabla antes de que el paso termine

### Requirement: Un smoke test fallido no revierte el deploy, pero deja instrucciones concretas

El sistema SHALL NOT revertir automáticamente un deploy cuyo smoke test falló. En su lugar, SHALL imprimir en el log del step la instrucción exacta de rollback manual —con el tag de la versión anterior ya resuelto, no un placeholder— reusando el mecanismo de rollback ya existente (`workflow_dispatch` de `deploy-backend.yml` con `ref` explícito).

#### Scenario: La instrucción de rollback incluye el tag real

- **WHEN** el smoke test falla contra `prod`
- **THEN** el log del step incluye el comando completo de rollback (`gh workflow run deploy-backend.yml -f environment=prod -f ref=<tag>`), con `<tag>` resuelto al tag existente inmediatamente anterior al commit recién desplegado

### Requirement: Un smoke test fallido muestra dónde buscar el error

El sistema SHALL intentar incluir, en el log del step de smoke test fallido, las líneas de log con `level=ERROR` más recientes del log group del handler `default` (`/aws/lambda/poker-planning-prod-default`), para no requerir salir de la corrida de CI para empezar a diagnosticar. No es una garantía dura (ver el escenario siguiente sobre fallos de permisos), pero el intento SHALL hacerse siempre.

Un fallo al obtener esas líneas (por ejemplo, permisos insuficientes del rol de deploy) SHALL NOT impedir que se imprima la instrucción de rollback del requirement anterior.

#### Scenario: El diagnóstico no bloquea la instrucción de rollback

- **WHEN** el smoke test falla y la consulta a CloudWatch Logs también falla (por ejemplo, por permisos)
- **THEN** el step igual imprime la instrucción de rollback antes de terminar en rojo
