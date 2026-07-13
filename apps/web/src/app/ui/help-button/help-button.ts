import { Component, output } from '@angular/core';

@Component({
  selector: 'app-help-button',
  imports: [],
  templateUrl: './help-button.html',
  styleUrl: './help-button.scss',
})
export class HelpButton {
  readonly opened = output<void>();
}
