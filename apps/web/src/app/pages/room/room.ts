import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AVAILABLE_DECKS, MODERATION_CLAIM_DELAY_MS } from 'shared-contracts';
import { RoomSocketService } from '../../core/room-socket.service';
import { ParticipantList } from '../../ui/participant-list/participant-list';
import { VotingBoard } from '../../ui/voting-board/voting-board';
import { RevealPanel } from '../../ui/reveal-panel/reveal-panel';
import { Notice } from '../../ui/notice/notice';

@Component({
  selector: 'app-room',
  imports: [ParticipantList, VotingBoard, RevealPanel, Notice, FormsModule],
  templateUrl: './room.html',
  styleUrl: './room.scss',
})
export class RoomPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly socketService = inject(RoomSocketService);

  readonly room = this.socketService.room;
  readonly myName = this.socketService.myName;
  readonly roomSummary = this.socketService.roomSummary;
  readonly connected = this.socketService.connected;
  readonly joinRejectedReason = this.socketService.joinRejectedReason;
  private readonly errorMessage = this.socketService.errorMessage;
  readonly roomIdFromUrl = this.route.snapshot.paramMap.get('roomId');

  // Reconectando a mitad de sesión: ya hubo `room` cargado, pero el socket se cayó. No hay
  // que reemplazar la vista de la sala por un estado de carga — el participante no debería
  // perder de vista lo que estaba mirando mientras el runtime reintenta solo.
  readonly reconnecting = computed(() => !this.connected() && this.room() !== null);

  nextStoryTitle = '';

  /** Texto del aviso temporal; `null` si no hay ninguno. */
  readonly notice = signal<string | null>(null);

  // Nada empuja un `roomState` cuando se cumple el plazo para tomar la moderación, así que
  // mientras el moderador esté caído la sala lleva su propio reloj para reevaluarlo.
  private readonly now = signal(Date.now());

  // Qué acción de moderación espera respuesta. Distingue "me la cedieron" de "la tomé yo"
  // (solo lo primero merece aviso) y permite atribuir un rechazo del servidor.
  private pendingModerationAction: 'transfer' | 'claim' | null = null;
  private previousIsModerator: boolean | null = null;

  constructor() {
    effect((onCleanup) => {
      if (!this.moderatorDisconnected()) return;
      this.now.set(Date.now());
      const timer = setInterval(() => this.now.set(Date.now()), 1000);
      onCleanup(() => clearInterval(timer));
    });

    effect(() => {
      if (!this.room()) return;
      const isModerator = this.isModerator();
      // La primera sala cargada no es una transición: un moderador que recarga no recibió nada.
      if (this.previousIsModerator === false && isModerator && this.pendingModerationAction !== 'claim') {
        this.notice.set('Ahora sos el moderador');
      }
      if (this.previousIsModerator !== isModerator) this.pendingModerationAction = null;
      this.previousIsModerator = isModerator;
    });

    effect(() => {
      if (this.errorMessage() === null || this.pendingModerationAction === null) return;
      this.notice.set(
        this.pendingModerationAction === 'claim'
          ? 'No se pudo tomar la moderación.'
          : 'No se pudo ceder la moderación.'
      );
      this.pendingModerationAction = null;
    });

    if (!this.roomIdFromUrl) return;

    if (this.socketService.hasSessionFor(this.roomIdFromUrl)) {
      this.socketService.rejoinIfNeeded(this.roomIdFromUrl);
    } else {
      this.router.navigate(['/'], { queryParams: { room: this.roomIdFromUrl } });
      return;
    }

    effect(() => {
      if (this.joinRejectedReason() !== null) {
        this.router.navigate(['/'], { queryParams: { room: this.roomIdFromUrl } });
      }
    });
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

  readonly moderatorDisconnected = computed(() => {
    const room = this.room();
    const moderator = room?.participants.find((p) => p.name === room.moderatorName);
    return !!moderator && !moderator.connected;
  });

  readonly canClaimModeration = computed(() => {
    const room = this.room();
    const moderator = room?.participants.find((p) => p.name === room.moderatorName);
    if (!moderator || moderator.connected || this.isModerator() || !this.myParticipant()?.connected) {
      return false;
    }
    // Sin marca de tiempo = desconectado antes de que existiera el campo: ya pasó el plazo.
    // El servidor vuelve a validarlo; si este reloj adelanta, el rechazo llega como aviso.
    return (
      moderator.disconnectedAt === null ||
      this.now() - moderator.disconnectedAt >= MODERATION_CLAIM_DELAY_MS
    );
  });

  readonly deck = computed(() => {
    const room = this.room();
    if (!room) return null;
    return AVAILABLE_DECKS.find((deck) => deck.id === room.deckId) ?? null;
  });

  readonly deckValues = computed(() => this.deck()?.values ?? []);

  readonly deckDisplayValues = computed(() => this.deck()?.displayValues ?? null);

  readonly deckNumericValues = computed(() => this.deck()?.numericValues ?? null);

  readonly voteProgress = computed(() => {
    const room = this.room();
    if (!room) return { voted: 0, total: 0 };
    const voters = room.participants.filter((p) => p.isVoter && p.connected);
    const voted = voters.filter((p) => p.vote !== null).length;
    return { voted, total: voters.length };
  });

  get shareLink(): string {
    return window.location.href;
  }

  modeAsNumber(mode: string[]): number | null {
    if (mode.length !== 1) return null;
    const numericValues = this.deckNumericValues();
    const value = numericValues?.[mode[0]] ?? Number(mode[0]);
    return Number.isFinite(value) ? value : null;
  }

  valueLabel(value: number): string {
    const numericValues = this.deckNumericValues();
    if (!numericValues) return `${value}`;
    const entry = Object.entries(numericValues).find(([, num]) => num === value);
    return entry ? entry[0] : `${value}`;
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

  transferModeration(targetName: string): void {
    const room = this.room();
    if (!room) return;
    this.pendingModerationAction = 'transfer';
    this.socketService.send({ action: 'transferModeration', roomId: room.roomId, targetName });
  }

  claimModeration(): void {
    const room = this.room();
    if (!room) return;
    this.pendingModerationAction = 'claim';
    this.socketService.send({ action: 'claimModeration', roomId: room.roomId });
  }

  closeRoom(): void {
    const room = this.room();
    if (!room) return;
    this.socketService.send({ action: 'closeRoom', roomId: room.roomId });
  }
}
