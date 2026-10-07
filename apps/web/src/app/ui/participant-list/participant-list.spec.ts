import { TestBed } from '@angular/core/testing';
import { Participant } from 'shared-contracts';
import { ParticipantList } from './participant-list';

function participante(name: string, overrides: Partial<Participant> = {}): Participant {
  return {
    name,
    isModerator: false,
    isVoter: true,
    connected: true,
    disconnectedAt: null,
    vote: null,
    icon: null,
    ...overrides,
  };
}

const sala = [
  participante('beto'),
  participante('ana', { isModerator: true }),
  participante('carla', { connected: false, disconnectedAt: 1 }),
  participante('dani'),
];

async function render(isModerator: boolean, participants = sala) {
  const fixture = TestBed.createComponent(ParticipantList);
  fixture.componentRef.setInput('participants', participants);
  fixture.componentRef.setInput('isModerator', isModerator);
  await fixture.whenStable();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

function botonesDeMenu(host: HTMLElement) {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('[aria-haspopup="menu"]'));
}

function nombres(host: HTMLElement) {
  return Array.from(host.querySelectorAll('.participant-list__name')).map((n) => n.textContent?.trim());
}

describe('ParticipantList — orden', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ParticipantList] }).compileComponents();
  });

  it('muestra al moderador primero y deja al resto en su orden', async () => {
    const { host } = await render(false);

    expect(nombres(host)).toEqual(['ana', 'beto', 'carla', 'dani']);
  });

  it('cuando cambia el moderador, el nuevo pasa a la primera fila', async () => {
    const { fixture, host } = await render(false);

    fixture.componentRef.setInput('participants', [
      participante('beto'),
      participante('ana'),
      participante('carla', { connected: false, disconnectedAt: 1 }),
      participante('dani', { isModerator: true }),
    ]);
    await fixture.whenStable();

    expect(nombres(host)).toEqual(['dani', 'beto', 'ana', 'carla']);
  });
});

describe('ParticipantList — ceder la moderación', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ParticipantList] }).compileComponents();
  });

  it('el moderador ve el menú de acciones solo junto a los participantes conectados que no son él', async () => {
    const { host } = await render(true);

    expect(botonesDeMenu(host).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Acciones para beto',
      'Acciones para dani',
    ]);
  });

  it('un participante que no modera no ve el menú', async () => {
    const { host } = await render(false);

    expect(botonesDeMenu(host)).toEqual([]);
  });

  it('el menú arranca cerrado y se abre al activarlo', async () => {
    const { fixture, host } = await render(true);
    const [boton] = botonesDeMenu(host);

    expect(host.querySelector('[role="menu"]')).toBeNull();
    expect(boton.getAttribute('aria-expanded')).toBe('false');

    boton.click();
    await fixture.whenStable();

    expect(host.querySelector('[role="menuitem"]')?.textContent).toContain('Hacer moderador');
    expect(boton.getAttribute('aria-expanded')).toBe('true');
  });

  it('al elegir "Hacer moderador" emite el nombre y cierra el menú', async () => {
    const { fixture, host } = await render(true);
    const elegido = vi.fn();
    fixture.componentInstance.transferModeration.subscribe(elegido);

    botonesDeMenu(host)[0].click();
    await fixture.whenStable();
    host.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click();
    await fixture.whenStable();

    expect(elegido).toHaveBeenCalledWith('beto');
    expect(host.querySelector('[role="menu"]')).toBeNull();
  });

  it('abrir el menú de otro participante cambia de menú en vez de cerrarlos', async () => {
    const { fixture, host } = await render(true);
    const [beto, dani] = botonesDeMenu(host);

    beto.click();
    await fixture.whenStable();
    dani.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.openMenuFor()).toBe('dani');
  });

  it('se cierra con Escape y con un clic afuera', async () => {
    const { fixture, host } = await render(true);

    botonesDeMenu(host)[0].click();
    await fixture.whenStable();
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(host.querySelector('[role="menu"]')).toBeNull();

    botonesDeMenu(host)[0].click();
    await fixture.whenStable();
    document.body.click();
    await fixture.whenStable();
    expect(host.querySelector('[role="menu"]')).toBeNull();
  });
});
