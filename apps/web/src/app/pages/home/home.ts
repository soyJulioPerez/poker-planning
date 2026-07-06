import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AVAILABLE_DECKS } from 'shared-contracts';
import { RoomSocketService } from '../../core/room-socket.service';

type Mode = 'create' | 'join';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly socketService = inject(RoomSocketService);
  private readonly router = inject(Router);

  readonly decks = AVAILABLE_DECKS;
  readonly mode = signal<Mode>('join');

  moderatorName = '';
  deckId = AVAILABLE_DECKS[0].id;
  moderatorIsVoter = true;

  joinRoomId = '';
  joinName = '';

  readonly joinRejectedReason = this.socketService.joinRejectedReason;

  constructor() {
    effect(() => {
      const room = this.socketService.room();
      const name = this.socketService.myName();
      if (room && name) {
        this.socketService.saveSession(room.roomId, name);
        this.router.navigate(['/room', room.roomId]);
      }
    });
  }

  setMode(mode: Mode): void {
    this.mode.set(mode);
  }

  createRoom(): void {
    if (!this.moderatorName.trim()) return;
    this.socketService.myName.set(this.moderatorName.trim());
    this.socketService.connect();
    this.socketService.send({
      action: 'createRoom',
      moderatorName: this.moderatorName.trim(),
      deckId: this.deckId,
      moderatorIsVoter: this.moderatorIsVoter,
    });
  }

  joinRoom(): void {
    if (!this.joinRoomId.trim() || !this.joinName.trim()) return;
    this.socketService.myName.set(this.joinName.trim());
    this.socketService.connect();
    this.socketService.send({
      action: 'joinRoom',
      roomId: this.joinRoomId.trim().toUpperCase(),
      name: this.joinName.trim(),
    });
  }
}
