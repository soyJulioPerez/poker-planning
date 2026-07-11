import { Component, computed, input, output } from '@angular/core';

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
      @if (displayIcons()) {
        <span class="card__icons">{{ displayIcons() }}</span>
      }
      <span class="card__value">{{ value() }}</span>
    </button>
  `,
  styleUrl: './card.scss',
})
export class Card {
  readonly value = input.required<string>();
  readonly displayValue = input<string | null>(null);
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly pick = output<string>();

  readonly displayIcons = computed(() => {
    const display = this.displayValue();
    if (!display || display === this.value()) return null;
    const spaceIndex = display.lastIndexOf(' ');
    return spaceIndex === -1 ? display : display.slice(0, spaceIndex);
  });
}
