import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          // Dos ejes. scope:* dice a qué parte del producto pertenece un proyecto;
          // type:* dice qué clase de artefacto es. Las constraints son conjuntivas:
          // un import tiene que ser permitido por TODAS las que matcheen los tags
          // del origen. Ver openspec/changes/archive/*-enable-module-boundaries/design.md
          depConstraints: [
            // --- scope: quién puede ver a quién ---
            {
              // La base del grafo: los contratos no dependen de sus consumidores.
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              // Lógica de sala común a web y mobile. Deliberadamente NO es
              // scope:shared: si lo fuera, realtime-api podría importarla.
              sourceTag: 'scope:client',
              onlyDependOnLibsWithTags: ['scope:client', 'scope:shared'],
            },
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: ['scope:web', 'scope:client', 'scope:shared'],
            },
            {
              sourceTag: 'scope:mobile',
              onlyDependOnLibsWithTags: ['scope:mobile', 'scope:client', 'scope:shared'],
            },
            {
              // La API no ve código de cliente: el WebSocket es un límite de red,
              // no un import.
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: ['scope:api', 'scope:shared'],
            },
            {
              // Los e2e manejan la app por el navegador. Se les permite shared
              // para construir aserciones sobre los contratos, nada más.
              sourceTag: 'scope:e2e',
              onlyDependOnLibsWithTags: ['scope:e2e', 'scope:shared'],
            },

            // --- type: la dirección del grafo ---
            // Ninguna de estas listas incluye type:app. Ahí vive la regla
            // "nadie depende de una aplicación": las apps son hojas.
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util'],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: ['type:feature', 'type:util'],
            },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:feature', 'type:util'],
            },
            {
              sourceTag: 'type:e2e',
              onlyDependOnLibsWithTags: ['type:util'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
