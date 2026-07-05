import { Component, input, output } from '@angular/core';
import { Card } from '../card/card';

@Component({
  selector: 'app-voting-board',
  imports: [Card],
  templateUrl: './voting-board.html',
  styleUrl: './voting-board.scss',
})
export class VotingBoard {
  readonly deckValues = input.required<string[]>();
  readonly myVote = input<string | null>(null);
  readonly disabled = input(false);
  readonly vote = output<string>();
}
