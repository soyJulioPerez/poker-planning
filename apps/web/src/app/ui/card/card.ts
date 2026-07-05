import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-card',
  template: `
    <button
      type="button"
      class="card"
      [class.card--selected]="selected()"
      [disabled]="disabled()"
      (click)="pick.emit(value())"
    >
      {{ value() }}
    </button>
  `,
  styleUrl: './card.scss',
})
export class Card {
  readonly value = input.required<string>();
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly pick = output<string>();
}
