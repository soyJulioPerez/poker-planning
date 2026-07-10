import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Participant } from 'shared-contracts';
import { ModeratorBadge } from '../moderator-badge/moderator-badge';

@Component({
  selector: 'app-participant-list',
  imports: [ModeratorBadge, FormsModule],
  templateUrl: './participant-list.html',
  styleUrl: './participant-list.scss',
})
export class ParticipantList {
  readonly participants = input.required<Participant[]>();
  readonly isModerator = input(false);
  readonly canChangeVoterStatus = input(false);

  readonly moderatorIsVoterChange = output<boolean>();
}
