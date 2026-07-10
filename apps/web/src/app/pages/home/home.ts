import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AVAILABLE_DECKS } from 'shared-contracts';
import { RoomSocketService } from '../../core/room-socket.service';

type Mode = 'create' | 'join';

const SUBMIT_TIMEOUT_MS = 10000;

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly socketService = inject(RoomSocketService);
  private readonly router = inject(Router);
  private submitTimeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly decks = AVAILABLE_DECKS;
  readonly mode = signal<Mode>('join');

  moderatorName = '';
  deckId = AVAILABLE_DECKS[0].id;
  moderatorIsVoter = true;

  joinRoomId = '';
  joinName = '';

  readonly isSubmitting = signal(false);
  readonly submitTimedOut = signal(false);

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

    effect(() => {
      if (this.joinRejectedReason() !== null) {
        this.stopSubmitting();
      }
    });
  }

  private startSubmitting(): void {
    this.submitTimedOut.set(false);
    this.isSubmitting.set(true);
    this.submitTimeoutId = setTimeout(() => {
      this.isSubmitting.set(false);
      this.submitTimedOut.set(true);
    }, SUBMIT_TIMEOUT_MS);
  }

  private stopSubmitting(): void {
    if (this.submitTimeoutId !== null) {
      clearTimeout(this.submitTimeoutId);
      this.submitTimeoutId = null;
    }
    this.isSubmitting.set(false);
  }

  setMode(mode: Mode): void {
    this.mode.set(mode);
  }

  createRoom(): void {
    if (!this.moderatorName.trim()) return;
    this.startSubmitting();
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
    this.startSubmitting();
    this.socketService.myName.set(this.joinName.trim());
    this.socketService.connect();
    this.socketService.send({
      action: 'joinRoom',
      roomId: this.joinRoomId.trim().toUpperCase(),
      name: this.joinName.trim(),
    });
  }
}
