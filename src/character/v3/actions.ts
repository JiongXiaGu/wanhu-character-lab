import type { Motion } from './types';

export type BoneMask =
  | 'full_body'
  | 'upper_body'
  | 'hands';

export type PropSocket =
  | 'none'
  | 'left_hand'
  | 'right_hand'
  | 'both_hands'
  | 'back';

export type ActionEvent = {
  time: number;
  id: string;
};

export interface ActionDefinition {
  id: string;
  motion: Motion;
  mask: BoneMask;
  propSocket: PropSocket;
  events: readonly ActionEvent[];
}

export const BASIC_ACTIONS: readonly ActionDefinition[] = [
  {
    id: 'pick',
    motion: 'idle',
    mask: 'full_body',
    propSocket: 'both_hands',
    events: [{ time: 0.7, id: 'pickup_complete' }],
  },
  {
    id: 'place',
    motion: 'idle',
    mask: 'full_body',
    propSocket: 'both_hands',
    events: [{ time: 0.65, id: 'place_complete' }],
  },
  {
    id: 'carry_front',
    motion: 'walk',
    mask: 'upper_body',
    propSocket: 'both_hands',
    events: [],
  },
  {
    id: 'carry_back',
    motion: 'walk',
    mask: 'upper_body',
    propSocket: 'back',
    events: [],
  },
  {
    id: 'push',
    motion: 'walk',
    mask: 'upper_body',
    propSocket: 'both_hands',
    events: [{ time: 0.5, id: 'push_contact' }],
  },
  {
    id: 'tool_swing_two_hand',
    motion: 'squat',
    mask: 'upper_body',
    propSocket: 'both_hands',
    events: [{ time: 0.42, id: 'tool_contact' }],
  },
];
