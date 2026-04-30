import React, { useEffect, useRef } from 'react';

export interface FeedbackMessage {
  id: string;
  text: string;
  type: 'player' | 'enemy' | 'critical' | 'heal' | 'system';
  timestamp: number;
}

interface Props {
  messages: FeedbackMessage[];
  maxMessages?: number;
}

export const CombatFeedbackArea: React.FC<Props> = ({ messages, maxMessages = 50 }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  // Trim messages to max if needed
  const displayMessages = messages.slice(-maxMessages);

  return (
    <div className="combat-feedback-area" ref={containerRef}>
      {displayMessages.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          Combat log will appear here
        </div>
      ) : (
        displayMessages.map((msg) => (
          <div key={msg.id} className={`feedback-entry ${msg.type}`}>
            {msg.text}
          </div>
        ))
      )}
    </div>
  );
};
