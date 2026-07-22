# Extensión GitHub Actions de VS Code: setup para cuentas con alias SSH

**Síntoma**: el panel GITHUB ACTIONS de VS Code (extensión `github.vscode-github-actions`) muestra "Unable to connect to the GitHub API, please check your internet connection", incluso con conexión a internet funcionando y la cuenta correcta de GitHub logueada en VS Code (visible en el ícono de cuenta, abajo a la izquierda).

El panel Output de la extensión ("GitHub Actions") muestra el error real:

```
Activating GitHub Actions extension...
Error getting GitHub context
Invalid URL
TypeError: Invalid URL
    at new URL (node:internal/url:...)
    ...extension-node.js...
```

**Causa**: la extensión intenta parsear la URL del remote `origin` para descubrir el repo de GitHub. Este proyecto usa un `origin` en SSH con un **alias de host** definido en `~/.ssh/config` para separar identidades de git multi-cuenta, por ejemplo:

```
origin	git@github-soyJulioPerez:soyJulioPerez/poker-planning.git
```

`github-soyJulioPerez` es un `Host` de `~/.ssh/config` (no `github.com` literal):

```
Host github-soyJulioPerez
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_soyJulioPerez
```

`git`/`ssh` resuelven ese alias sin problema, pero la extensión hace `new URL(...)` directo sobre el remote y ese formato no es una URL válida reconocible, así que falla al activarse.

**Solución aplicada**: no se tocó `origin` (para no perder la separación de cuentas SSH). En su lugar:

1. Se agregó un remote adicional, solo para que la extensión lo use, apuntando a la misma URL pero en HTTPS:

   ```bash
   git remote add github-actions https://github.com/soyJulioPerez/poker-planning.git
   ```

2. Se configuró la extensión (setting `github-actions.remote-name`, que por defecto es `"origin"`) para que use ese remote en vez de `origin`, en [.vscode/settings.json](../.vscode/settings.json):

   ```json
   {
     "github-actions.remote-name": "github-actions"
   }
   ```

3. Se recargó la ventana de VS Code (`Developer: Reload Window`) para que la extensión releyera la configuración y los remotes.

**Impacto para otros colaboradores**: si tu `origin` ya apunta directo a `github.com` (sin alias de `~/.ssh/config`), no necesitás hacer nada — la extensión debería funcionar out-of-the-box. Si usás un setup multi-cuenta SSH similar (alias de host propio), necesitás agregar tu propio remote local `github-actions` apuntando al mismo repo en HTTPS (o SSH sin alias) como en el paso 1; el nombre del remote ya está configurado en el repo vía `.vscode/settings.json`.

**Nota**: el remote `github-actions` es una comodidad local de cada desarrollador, no se usa para push/pull normales (eso lo sigue haciendo `origin`).
