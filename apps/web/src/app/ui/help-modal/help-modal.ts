import { Component, HostListener, output, signal } from '@angular/core';

type HelpTab = 'new' | 'moderator' | 'reminder';

@Component({
  selector: 'app-help-modal',
  imports: [],
  templateUrl: './help-modal.html',
  styleUrl: './help-modal.scss',
})
export class HelpModal {
  readonly closed = output<void>();

  readonly activeTab = signal<HelpTab>('new');

  setTab(tab: HelpTab): void {
    this.activeTab.set(tab);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
