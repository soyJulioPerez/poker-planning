import { Component } from '@angular/core';

@Component({
  selector: 'app-moderator-badge',
  // role="img" + aria-label: un `title` en un <span> no participa del accessible
  // name de forma confiable, y el emoji solo se anunciaría por su nombre Unicode.
  template: `<span class="moderator-badge" role="img" title="Moderador" aria-label="Moderador">🧙</span>`,
  styleUrl: './moderator-badge.scss',
})
export class ModeratorBadge {}
