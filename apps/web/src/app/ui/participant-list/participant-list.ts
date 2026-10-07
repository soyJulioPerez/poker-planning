import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Participant } from 'shared-contracts';
import { ModeratorBadge } from '../moderator-badge/moderator-badge';

@Component({
  selector: 'app-participant-list',
  imports: [ModeratorBadge, FormsModule],
  templateUrl: './participant-list.html',
  styleUrl: './participant-list.scss',
  host: {
    '(document:click)': 'closeMenuOnOutsideClick($event)',
    '(keydown.escape)': 'closeMenuAndRestoreFocus()',
  },
})
export class ParticipantList {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly participants = input.required<Participant[]>();
  readonly isModerator = input(false);
  readonly canChangeVoterStatus = input(false);

  readonly moderatorIsVoterChange = output<boolean>();
  readonly transferModeration = output<string>();

  /** Nombre del participante cuyo menú de acciones está abierto. */
  readonly openMenuFor = signal<string | null>(null);

  // El moderador va primero: es a quien se mira para saber quién conduce, y después de un
  // cambio de titular el nuevo moderador no queda perdido en el medio de la lista.
  readonly orderedParticipants = computed(() => {
    const participants = this.participants();
    return [...participants.filter((p) => p.isModerator), ...participants.filter((p) => !p.isModerator)];
  });

  toggleMenu(name: string): void {
    this.openMenuFor.update((open) => (open === name ? null : name));
    if (this.openMenuFor() === null) return;
    // Patrón de botón de menú: al abrir, el foco pasa a la primera opción para que el
    // teclado pueda elegirla sin tener que buscarla con Tab.
    afterNextRender(() => this.menuElement()?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), {
      injector: this.injector,
    });
  }

  closeMenu(): void {
    this.openMenuFor.set(null);
  }

  closeMenuAndRestoreFocus(): void {
    const trigger = this.menuElement()?.querySelector<HTMLElement>('[aria-haspopup="menu"]');
    this.closeMenu();
    trigger?.focus();
  }

  closeMenuOnOutsideClick(event: MouseEvent): void {
    if (this.openMenuFor() === null) return;
    // Un clic dentro de cualquier menú (incluido el ⋮ de otro participante) ya lo resolvió
    // `toggleMenu`; cerrarlo acá desharía la apertura del menú nuevo.
    const target = event.target as Element | null;
    if (target?.closest('.participant-list__menu-wrapper')) return;
    this.closeMenu();
  }

  private menuElement(): HTMLElement | null {
    return this.host.nativeElement.querySelector('.participant-list__menu-wrapper--open');
  }

  chooseTransfer(name: string): void {
    this.closeMenu();
    this.transferModeration.emit(name);
  }
}
