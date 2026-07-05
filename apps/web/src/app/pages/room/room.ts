import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RoomSocketService } from '../../core/room-socket.service';
import { ParticipantList } from '../../ui/participant-list/participant-list';

@Component({
  selector: 'app-room',
  imports: [ParticipantList],
  templateUrl: './room.html',
  styleUrl: './room.scss',
})
export class RoomPage {
  private readonly route = inject(ActivatedRoute);
  private readonly socketService = inject(RoomSocketService);

  readonly room = this.socketService.room;
  readonly roomIdFromUrl = this.route.snapshot.paramMap.get('roomId');

  get shareLink(): string {
    return `${window.location.origin}/room/${this.roomIdFromUrl}`;
  }
}
