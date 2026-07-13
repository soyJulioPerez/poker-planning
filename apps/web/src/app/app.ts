import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HelpButton } from './ui/help-button/help-button';
import { HelpModal } from './ui/help-modal/help-modal';

@Component({
  imports: [RouterModule, HelpButton, HelpModal],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'web';
  protected readonly helpOpen = signal(false);
}
