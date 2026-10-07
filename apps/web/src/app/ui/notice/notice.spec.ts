import { TestBed } from '@angular/core/testing';
import { Notice, NOTICE_DURATION_MS } from './notice';

async function render(message: string | null) {
  const fixture = TestBed.createComponent(Notice);
  fixture.componentRef.setInput('message', message);
  const dismissed = vi.fn();
  fixture.componentInstance.dismissed.subscribe(dismissed);
  // detectChanges y no whenStable: con fake timers, whenStable espera un timer que nunca corre.
  fixture.detectChanges();
  return { fixture, dismissed, host: fixture.nativeElement as HTMLElement };
}

describe('Notice', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Notice] }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Si la región apareciera recién junto con el texto, varios lectores de pantalla no
  // anunciarían el aviso: tiene que existir antes de que cambie su contenido.
  it('mantiene la región viva en el DOM aunque no haya aviso', async () => {
    const { host } = await render(null);

    const region = host.querySelector('[role="status"]');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.textContent?.trim()).toBe('');
  });

  it('muestra el texto dentro de la región viva', async () => {
    const { host } = await render('Ahora sos el moderador');

    expect(host.querySelector('[role="status"]')?.textContent).toContain('Ahora sos el moderador');
  });

  it('se cierra con el botón', async () => {
    const { host, dismissed } = await render('Ahora sos el moderador');

    host.querySelector<HTMLButtonElement>('.notice__close')?.click();

    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('se cierra solo pasado el tiempo del aviso', async () => {
    vi.useFakeTimers();
    const { dismissed } = await render('Ahora sos el moderador');

    vi.advanceTimersByTime(NOTICE_DURATION_MS - 1);
    expect(dismissed).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(dismissed).toHaveBeenCalledTimes(1);
  });
});
