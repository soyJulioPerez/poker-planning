#!/usr/bin/env node
/**
 * Verifica que NX_WORKSPACE_ROOT_PATH (si está definida) coincida con la ruta real
 * en disco, incluida la casing de la letra de unidad en Windows.
 *
 * Por qué existe: Nx respeta esa variable sin normalizarla, y Node cachea los
 * módulos ESM por string de URL. Si la variable trae "c:\..." y el disco dice
 * "C:\...", Vitest se carga dos veces y los tests fallan con mensajes que no
 * mencionan rutas por ningún lado ("Need to call TestBed.initTestEnvironment()
 * first" / "Vitest failed to find the runner").
 *
 * Ver docs/known-issues.md — "Vitest con Angular falla por la casing de la letra
 * de unidad en Windows".
 */
import { realpathSync } from 'node:fs';

const declared = process.env.NX_WORKSPACE_ROOT_PATH;

if (declared) {
  let real;
  try {
    real = realpathSync.native(declared);
  } catch {
    console.error(`NX_WORKSPACE_ROOT_PATH apunta a una ruta que no existe: ${declared}`);
    process.exit(1);
  }

  if (declared !== real) {
    console.error(
      [
        '',
        'NX_WORKSPACE_ROOT_PATH no coincide con la ruta real en disco:',
        '',
        `  declarada : ${declared}`,
        `  real      : ${real}`,
        '',
        'Esto hace que Node cargue Vitest dos veces y rompe todos los tests que',
        'usan TestBed, con errores que no mencionan rutas.',
        '',
        'Soluciones (ver docs/known-issues.md):',
        '  1. Abrir el proyecto en el IDE desde la ruta real de arriba.',
        '  2. En la terminal actual, limpiar la variable:',
        '       PowerShell : $env:NX_WORKSPACE_ROOT_PATH = $null',
        '       bash       : unset NX_WORKSPACE_ROOT_PATH',
        '     Nx recalcula el root solo, y lo hace bien.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
}
