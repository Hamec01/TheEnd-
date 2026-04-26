export type ContextMode = 'empty' | 'location' | 'npc' | 'combat';

export type ChatType = 'local' | 'private' | 'system';

export type PlayerWorldState = 'moving' | 'idle' | 'in_zone' | 'in_city' | 'in_combat';

export type WorldMapMode = 'play' | 'editor';

export type EditorSizeMode = 'normal' | 'editor';

export type {
  ZoneShape,
  ZoneType as WorldZoneType,
  ZoneEditorTool,
  WorldMapZone as EditorWorldZone,
  ZoneEditorDraft,
  ZoneEditorSettings,
} from './zoneEditorTypes';

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

export interface ChatMessage {
  id: string;
  text: string;
  type: ChatType;
}
