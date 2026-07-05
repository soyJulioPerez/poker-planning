import { Component, input } from '@angular/core';
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
}
