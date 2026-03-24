/** Roman Wall of Honour (Tabula Honoria) theme constants */
export const STONE = {
  bg: '#1a1710',
  bgLight: '#2a2418',
  card: 'rgba(255,215,100,0.04)',
  cardBorder: 'rgba(200,168,75,0.2)',
  text: '#d4c8a0',
  textMuted: '#8a7e60',
  gold: '#c8a84b',
  goldDark: '#8b6914',
  goldGlow: 'rgba(200,168,75,0.3)',
  danger: '#8b3a3a',
  inputBg: 'rgba(255,255,255,0.05)',
  inputBorder: 'rgba(200,168,75,0.3)',
} as const;

/** Inline style helpers */
export const stoneCard: React.CSSProperties = {
  background: STONE.card,
  border: `1px solid ${STONE.cardBorder}`,
  borderRadius: '12px',
  boxShadow: 'inset 0 1px 0 rgba(255,215,100,0.06), 0 4px 24px rgba(0,0,0,0.4)',
};

export const inscription: React.CSSProperties = {
  fontFamily: '"Playfair Display", serif',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.2em',
  color: STONE.gold,
  textShadow: `0 0 20px ${STONE.goldGlow}`,
};

export const stoneInput: React.CSSProperties = {
  background: STONE.inputBg,
  border: `1px solid ${STONE.inputBorder}`,
  borderRadius: '8px',
  color: STONE.text,
  fontFamily: '"IBM Plex Sans", sans-serif',
};

export const goldButton: React.CSSProperties = {
  background: `linear-gradient(180deg, ${STONE.gold} 0%, ${STONE.goldDark} 100%)`,
  color: '#1a1710',
  border: 'none',
  borderRadius: '8px',
  fontFamily: '"Playfair Display", serif',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  cursor: 'pointer',
};

/** SVG Greek meander border pattern */
export const meanderBorderSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='10'%3E%3Cpath d='M0 5h10v-5h5v10h5v-10h5v5h5v5h-5v-5h-5v5h-5v-5h-5v5h-5z' fill='none' stroke='%23c8a84b' stroke-width='0.5' opacity='0.3'/%3E%3C/svg%3E")`;
