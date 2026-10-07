import { Component, effect, input, output } from '@angular/core';

export const NOTICE_DURATION_MS = 6000;

/**
 * Aviso temporal no bloqueante.
 *
 * La región `role="status"` queda siempre en el DOM, aunque no haya aviso: los lectores de
 * pantalla anuncian los cambios de contenido de una región viva que ya existía, pero no
 * siempre una que aparece junto con el texto.
 */
@Component({
  selector: 'app-notice',
  templateUrl: './notice.html',
  styleUrl: './notice.scss',
})
export class Notice {
  readonly message = input<string | null>(null);

  readonly dismissed = output<void>();

  constructor() {
    effect((onCleanup) => {
      if (this.message() === null) return;
      const timer = setTimeout(() => this.dismissed.emit(), NOTICE_DURATION_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
