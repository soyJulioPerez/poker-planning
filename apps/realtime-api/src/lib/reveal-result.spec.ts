import { computeRevealResult } from './reveal-result';

// La escala interna del mazo T-Shirt, tal como la define `shared-contracts`.
// Se repite acá a propósito: si alguien cambia la escala del mazo, estos tests
// siguen verificando la regla de cálculo y no se rompen por un dato ajeno.
const TSHIRT_SCALE = { XS: 1, S: 2, M: 4, L: 8, XL: 16, XXL: 32 };

describe('computeRevealResult', () => {
  describe('distribución', () => {
    it('cuenta cuántas veces se votó cada valor', () => {
      const { distribution } = computeRevealResult({ ana: '5', beto: '5', caro: '8' });

      expect(distribution).toEqual(
        expect.arrayContaining([
          { value: '5', count: 2 },
          { value: '8', count: 1 },
        ])
      );
      expect(distribution).toHaveLength(2);
    });

    it('incluye los votos no numéricos, que también son información', () => {
      const { distribution } = computeRevealResult({ ana: '☕', beto: '?' });

      expect(distribution).toEqual(
        expect.arrayContaining([
          { value: '☕', count: 1 },
          { value: '?', count: 1 },
        ])
      );
    });
  });

  describe('promedio', () => {
    it('promedia los votos numéricos redondeando a un decimal', () => {
      // (3 + 5 + 8) / 3 = 5.333...
      const { average } = computeRevealResult({ ana: '3', beto: '5', caro: '8' });

      expect(average).toBe(5.3);
    });

    it('ignora los votos que no son un número', () => {
      // '?' no participa: el promedio es de 3 y 5, no de tres votos.
      const { average } = computeRevealResult({ ana: '3', beto: '5', caro: '?' });

      expect(average).toBe(4);
    });

    it('es null cuando nadie votó un valor numérico', () => {
      const { average } = computeRevealResult({ ana: '☕', beto: '?' });

      expect(average).toBeNull();
    });

    it('es null cuando no hay votos', () => {
      const { average } = computeRevealResult({});

      expect(average).toBeNull();
    });
  });

  // Regla introducida por el change `2026-07-19-tshirt-numeric-resolution`:
  // los mazos con siglas (XS, S, M...) traen una escala numérica interna, usada solo
  // para calcular. El promedio se redondea a la talla más cercana de esa escala, no
  // se devuelve como número crudo.
  describe('promedio con escala interna del mazo', () => {
    it('convierte las siglas a su número antes de promediar', () => {
      // S=2, L=8 → promedio crudo 5 → la talla más cercana es M=4
      const { average } = computeRevealResult({ ana: 'S', beto: 'L' }, TSHIRT_SCALE);

      expect(average).toBe(4);
    });

    it('ajusta a la talla más cercana por distancia lineal', () => {
      // M=4, XL=16 → promedio crudo 10 → distancias: |8-10|=2, |16-10|=6 → L=8
      const { average } = computeRevealResult({ ana: 'M', beto: 'XL' }, TSHIRT_SCALE);

      expect(average).toBe(8);
    });

    it('ante un empate de distancia se queda con la talla menor', () => {
      // S=2, M=4 → promedio crudo 3 → equidista de 2 y de 4.
      // Se documenta el desempate real: gana la menor, o sea la estimación conservadora.
      const { average } = computeRevealResult({ ana: 'S', beto: 'M' }, TSHIRT_SCALE);

      expect(average).toBe(2);
    });

    it('devuelve un valor de la escala aunque el promedio crudo no lo sea', () => {
      // XS=1, S=2, M=4 → crudo 2.3 → no existe esa talla; la más cercana es S=2
      const { average } = computeRevealResult({ ana: 'XS', beto: 'S', caro: 'M' }, TSHIRT_SCALE);

      expect(Object.values(TSHIRT_SCALE)).toContain(average);
      expect(average).toBe(2);
    });
  });

  describe('moda', () => {
    it('devuelve el valor más votado', () => {
      const { mode } = computeRevealResult({ ana: '5', beto: '5', caro: '8' });

      expect(mode).toEqual(['5']);
    });

    it('devuelve todos los empatados cuando no hay un único más votado', () => {
      const { mode } = computeRevealResult({ ana: '3', beto: '5' });

      expect(mode.sort()).toEqual(['3', '5']);
    });

    // El change `2026-07-11-fix-mode-numeric-only` NO cambió este cálculo: la moda de
    // un grupo que votó mayoritariamente "☕" es "☕", y eso es información correcta.
    // Lo que ese change agregó es que no se pueda *resolver* la historia con ese valor
    // — la defensa vive en `handleResolveStory`, no acá. Ver resolve-story.spec.ts.
    it('devuelve un valor no numérico si es el más votado', () => {
      const { mode } = computeRevealResult({ ana: '☕', beto: '☕', caro: '5' });

      expect(mode).toEqual(['☕']);
    });

    it('es un arreglo vacío cuando no hay votos', () => {
      const { mode } = computeRevealResult({});

      expect(mode).toEqual([]);
    });
  });

  it('devuelve los votos recibidos sin modificarlos', () => {
    const votes = { ana: '5', beto: '8' };

    expect(computeRevealResult(votes).votes).toEqual(votes);
  });
});
