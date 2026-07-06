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

  readonly resolveVote = output<number>();
  readonly newRound = output<void>();

  voteAsNumber(vote: string): number | null {
    const value = Number(vote);
    return Number.isFinite(value) ? value : null;
  }
}
