import { Component, input, output } from '@angular/core';
import { IconGroup } from 'shared-contracts';

@Component({
  selector: 'app-icon-picker',
  imports: [],
  templateUrl: './icon-picker.html',
  styleUrl: './icon-picker.scss',
})
export class IconPicker {
  readonly iconGroup = input.required<IconGroup>();
  readonly selectedIcon = input<string | null>(null);

  readonly iconSelected = output<string>();
}
