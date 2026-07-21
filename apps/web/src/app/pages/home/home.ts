import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AVAILABLE_DECKS, AVAILABLE_ICON_GROUPS } from 'shared-contracts';
import { RoomSocketService } from '../../core/room-socket.service';
import { IconPicker } from '../../ui/icon-picker/icon-picker';

type Mode = 'create' | 'join';

const SUBMIT_TIMEOUT_MS = 10000;

const NONE_ICON_GROUP_ID = 'none';

@Component({
  selector: 'app-home',
  imports: [FormsModule, IconPicker],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly socketService = inject(RoomSocketService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private submitTimeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly decks = AVAILABLE_DECKS;
  readonly iconGroups = AVAILABLE_ICON_GROUPS;
  readonly noneIconGroupId = NONE_ICON_GROUP_ID;
  readonly mode = signal<Mode>('join');

  moderatorName = '';
  deckId = AVAILABLE_DECKS[0].id;
  moderatorIsVoter = true;
  moderatorIconGroupId = NONE_ICON_GROUP_ID;
  moderatorIcon: string | null = null;

  joinRoomId = '';
  joinName = '';
  joinIcon: string | null = null;

  readonly isSubmitting = signal(false);
  readonly submitTimedOut = signal(false);
  readonly moderatorIconMissing = signal(false);
  readonly joinIconMissing = signal(false);

  readonly joinRejectedReason = this.socketService.joinRejectedReason;
  readonly joinRoomInfo = this.socketService.roomInfo;

  get selectedModeratorIconGroup() {
    return this.iconGroups.find((group) => group.id === this.moderatorIconGroupId) ?? null;
  }

  get joinIconGroup() {
    const iconGroupId = this.joinRoomInfo()?.iconGroupId;
    if (!iconGroupId) return null;
    return this.iconGroups.find((group) => group.id === iconGroupId) ?? null;
  }

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

    const roomFromQuery = this.route.snapshot.queryParamMap.get('room');
    if (roomFromQuery) {
      this.mode.set('join');
      this.joinRoomId = roomFromQuery.toUpperCase();
      this.fetchRoomInfoForJoin();
    }
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

  onModeratorIconGroupChange(): void {
    this.moderatorIcon = null;
  }

  selectModeratorIcon(icon: string): void {
    this.moderatorIcon = icon;
    this.moderatorIconMissing.set(false);
  }

  selectJoinIcon(icon: string): void {
    this.joinIcon = icon;
    this.joinIconMissing.set(false);
  }

  onJoinRoomIdBlur(): void {
    this.fetchRoomInfoForJoin();
  }

  private fetchRoomInfoForJoin(): void {
    const roomId = this.joinRoomId.trim().toUpperCase();
    if (!roomId) return;
    this.joinIcon = null;
    this.socketService.connect();
    this.socketService.send({ action: 'getRoomInfo', roomId });
  }

  createRoom(): void {
    if (!this.moderatorName.trim()) return;
    if (this.selectedModeratorIconGroup && !this.moderatorIcon) {
      this.moderatorIconMissing.set(true);
      return;
    }
    this.moderatorIconMissing.set(false);
    this.startSubmitting();
    this.socketService.myName.set(this.moderatorName.trim());
    this.socketService.connect();
    this.socketService.send({
      action: 'createRoom',
      moderatorName: this.moderatorName.trim(),
      deckId: this.deckId,
      moderatorIsVoter: this.moderatorIsVoter,
      ...(this.selectedModeratorIconGroup
        ? { iconGroupId: this.selectedModeratorIconGroup.id, icon: this.moderatorIcon ?? undefined }
        : {}),
    });
  }

  joinRoom(): void {
    if (!this.joinRoomId.trim() || !this.joinName.trim()) return;
    if (this.joinIconGroup && !this.joinIcon) {
      this.joinIconMissing.set(true);
      return;
    }
    this.joinIconMissing.set(false);
    this.startSubmitting();
    this.socketService.myName.set(this.joinName.trim());
    this.socketService.connect();
    this.socketService.send({
      action: 'joinRoom',
      roomId: this.joinRoomId.trim().toUpperCase(),
      name: this.joinName.trim(),
      ...(this.joinIcon ? { icon: this.joinIcon } : {}),
    });
  }
}
