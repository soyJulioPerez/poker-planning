import { Component, input } from '@angular/core';
import { Participant } from 'shared-contracts';
import { ModeratorBadge } from '../moderator-badge/moderator-badge';

@Component({
  selector: 'app-participant-list',
  imports: [ModeratorBadge],
  templateUrl: './participant-list.html',
  styleUrl: './participant-list.scss',
})
export class ParticipantList {
  readonly participants = input.required<Participant[]>();
}
