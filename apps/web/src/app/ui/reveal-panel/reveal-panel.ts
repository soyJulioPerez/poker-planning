import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RevealResult } from 'shared-contracts';

@Component({
  selector: 'app-reveal-panel',
  imports: [CommonModule],
  templateUrl: './reveal-panel.html',
  styleUrl: './reveal-panel.scss',
})
export class RevealPanel {
  readonly result = input.required<RevealResult>();
  readonly isModerator = input(false);
  readonly numericValues = input<Record<string, number> | null>(null);
  /** Promedio ya formateado ("9,67", "entre M y L"); `null` si no hubo votos numéricos. */
  readonly average = input<string | null>(null);

  readonly resolveVote = output<number>();
  readonly newRound = output<void>();

  voteAsNumber(vote: string): number | null {
    const value = this.numericValues()?.[vote] ?? Number(vote);
    return Number.isFinite(value) ? value : null;
  }
}
