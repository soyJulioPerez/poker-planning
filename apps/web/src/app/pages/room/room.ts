import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AVAILABLE_DECKS } from 'shared-contracts';
import { RoomSocketService } from '../../core/room-socket.service';
import { ParticipantList } from '../../ui/participant-list/participant-list';
import { VotingBoard } from '../../ui/voting-board/voting-board';
import { RevealPanel } from '../../ui/reveal-panel/reveal-panel';

@Component({
  selector: 'app-room',
  imports: [ParticipantList, VotingBoard, RevealPanel, FormsModule],
  templateUrl: './room.html',
  styleUrl: './room.scss',
})
export class RoomPage {
  private readonly route = inject(ActivatedRoute);
  private readonly socketService = inject(RoomSocketService);

  readonly room = this.socketService.room;
  readonly myName = this.socketService.myName;
  readonly roomSummary = this.socketService.roomSummary;
  readonly roomIdFromUrl = this.route.snapshot.paramMap.get('roomId');

  nextStoryTitle = '';

  constructor() {
    if (this.roomIdFromUrl) {
      this.socketService.rejoinIfNeeded(this.roomIdFromUrl);
    }
  }

  readonly isModerator = computed(() => {
    const room = this.room();
    return !!room && room.moderatorName === this.myName();
  });

  readonly myParticipant = computed(() => {
    const room = this.room();
    const name = this.myName();
    return room?.participants.find((p) => p.name === name) ?? null;
  });

  readonly deckValues = computed(() => {
    const room = this.room();
    if (!room) return [];
    return AVAILABLE_DECKS.find((deck) => deck.id === room.deckId)?.values ?? [];
  });

  readonly deckDisplayValues = computed(() => {
    const room = this.room();
    if (!room) return null;
    return AVAILABLE_DECKS.find((deck) => deck.id === room.deckId)?.displayValues ?? null;
  });

  readonly voteProgress = computed(() => {
    const room = this.room();
    if (!room) return { voted: 0, total: 0 };
    const voters = room.participants.filter((p) => p.isVoter && p.connected);
    const voted = voters.filter((p) => p.vote !== null).length;
    return { voted, total: voters.length };
  });

  get shareLink(): string {
    return `${window.location.origin}/room/${this.roomIdFromUrl}`;
  }

  modeAsNumber(mode: string[]): number | null {
    if (mode.length !== 1) return null;
    const value = Number(mode[0]);
    return Number.isFinite(value) ? value : null;
  }

  vote(value: string): void {
    const room = this.room();
    if (!room) return;
    this.socketService.send({ action: 'vote', roomId: room.roomId, value });
  }

  reveal(): void {
    const room = this.room();
    if (!room) return;
    this.socketService.send({ action: 'reveal', roomId: room.roomId });
  }

  resolveWith(score: number): void {
    const room = this.room();
    if (!room) return;
    this.socketService.send({ action: 'resolveStory', roomId: room.roomId, finalScore: score });
  }

  newRound(): void {
    const room = this.room();
    if (!room) return;
    this.socketService.send({ action: 'newRound', roomId: room.roomId });
  }

  nextStory(): void {
    const room = this.room();
    if (!room || !this.nextStoryTitle.trim()) return;
    this.socketService.send({
      action: 'nextStory',
      roomId: room.roomId,
      storyTitle: this.nextStoryTitle.trim(),
    });
    this.nextStoryTitle = '';
  }

  setModeratorIsVoter(isVoter: boolean): void {
    const room = this.room();
    if (!room) return;
    this.socketService.send({ action: 'setModeratorIsVoter', roomId: room.roomId, isVoter });
  }

  closeRoom(): void {
    const room = this.room();
    if (!room) return;
    this.socketService.send({ action: 'closeRoom', roomId: room.roomId });
  }
}
