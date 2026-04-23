export type ContextMode = 'empty' | 'location' | 'npc' | 'combat';

export interface MapAction {
  id: string;
  label: string;
  kind: 'travel' | 'trade' | 'talk' | 'scout' | 'combat' | 'quest' | 'rest' | 'enter';
}

export interface MapNodeData {
  id: string;
  name: string;
  type: string;
  faction: string;
  danger: 'Low' | 'Medium' | 'High';
  access: 'Friendly' | 'Neutral' | 'Hostile' | 'Locked';
  recommendedLevel: number;
  description: string;
  tooltip: string;
  x: number;
  y: number;
  actions: MapAction[];
}
