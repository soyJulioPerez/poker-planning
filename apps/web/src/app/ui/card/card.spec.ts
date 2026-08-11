import { TestBed } from '@angular/core/testing';
import { Card } from './card';

async function render(value: string, selected: boolean) {
  const fixture = TestBed.createComponent(Card);
  fixture.componentRef.setInput('value', value);
  fixture.componentRef.setInput('selected', selected);
  await fixture.whenStable();

  return fixture.nativeElement as HTMLElement;
}

describe('Card', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Card] }).compileComponents();
  });

  it('comunica por ARIA que la carta está elegida, no solo por color', async () => {
    // Sin esto, el estado solo existe como la clase card--selected: quien no ve la
    // pantalla no tiene forma de confirmar qué votó.
    const host = await render('5', true);

    expect(host.querySelector('button')?.getAttribute('aria-pressed')).toBe('ROTO-A-PROPOSITO');
  });

  it('comunica que una carta no elegida no lo está', async () => {
    const host = await render('8', false);

    expect(host.querySelector('button')?.getAttribute('aria-pressed')).toBe('false');
  });
});
