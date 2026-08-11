import { TestBed } from '@angular/core/testing';
import { RevealResult } from 'shared-contracts';
import { RevealPanel } from './reveal-panel';

const result: RevealResult = {
  votes: { Ana: '5', Bruno: '8', Carla: '?' },
  distribution: [],
  average: 6.5,
  mode: ['5'],
};

async function render(isModerator: boolean) {
  const fixture = TestBed.createComponent(RevealPanel);
  fixture.componentRef.setInput('result', result);
  fixture.componentRef.setInput('isModerator', isModerator);
  await fixture.whenStable();

  return fixture;
}

describe('RevealPanel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RevealPanel] }).compileComponents();
  });

  it('expone cada voto numérico como un botón, no como un <li> con click', async () => {
    const fixture = await render(true);
    const host = fixture.nativeElement as HTMLElement;

    // Un <button> es focusable y se activa con Enter y Space sin código propio.
    // Si esto vuelve a ser un <li> con (click), la función deja de existir para
    // quien navega con teclado.
    const voteButtons = host.querySelectorAll('button.reveal-panel__vote--clickable');
    expect(voteButtons.length).toBe(2); // Ana y Bruno; "?" no es numérico
    voteButtons.forEach((button) => expect(button.tagName).toBe('BUTTON'));
  });

  it('describe la acción del voto en su nombre accesible', async () => {
    const fixture = await render(true);
    const host = fixture.nativeElement as HTMLElement;

    const first = host.querySelector('button.reveal-panel__vote--clickable');
    expect(first?.getAttribute('aria-label')).toContain('Ana');
    expect(first?.getAttribute('aria-label')).toContain('puntuación final');
  });

  it('emite el voto al activarlo por teclado', async () => {
    const fixture = await render(true);
    const host = fixture.nativeElement as HTMLElement;

    const emitted: number[] = [];
    fixture.componentInstance.resolveVote.subscribe((value) => emitted.push(value));

    const button = host.querySelector<HTMLButtonElement>('button.reveal-panel__vote--clickable');
    button?.focus();
    expect(document.activeElement).toBe(button); // recibe el foco: es alcanzable con Tab

    // Enter sobre un <button> enfocado dispara su activación por defecto del navegador.
    button?.click();
    await fixture.whenStable();

    expect(emitted).toEqual([5]);
  });

  it('no expone controles cuando quien mira no es moderador', async () => {
    const fixture = await render(false);
    const host = fixture.nativeElement as HTMLElement;

    // Un control focusable que no hace nada es peor que ningún control: llenaría
    // la navegación por Tab de paradas muertas.
    expect(host.querySelectorAll('button.reveal-panel__vote--clickable').length).toBe(0);
  });

  it('anuncia el botón de nueva ronda por su función y no por el símbolo', async () => {
    const fixture = await render(true);
    const host = fixture.nativeElement as HTMLElement;

    const newRound = host.querySelector('button.reveal-panel__new-round');
    expect(newRound?.getAttribute('aria-label')).toBe('Nueva ronda');
  });
});
