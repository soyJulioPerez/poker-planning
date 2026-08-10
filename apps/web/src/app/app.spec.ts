import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { appRoutes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(appRoutes)],
    }).compileComponents();
  });

  it('should create the app', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the home page by default', async () => {
    const fixture = TestBed.createComponent(App);
    // El router no dispara la navegación inicial por su cuenta en tests:
    // sin este navigate el router-outlet queda vacío y no hay <h1> que buscar.
    await TestBed.inject(Router).navigate(['/']);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Planning Poker');
  });
});
