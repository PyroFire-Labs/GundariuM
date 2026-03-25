import { createCanvas, loadImage, type Canvas } from "@napi-rs/canvas";
import type { Rarity } from "@/types/nft";
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  PHOTO_X,
  PHOTO_Y,
  PHOTO_WIDTH,
  PHOTO_HEIGHT,
  HEADER_HEIGHT,
  NAMEPLATE_HEIGHT,
  PHOTO_PADDING,
  BRACKET_SIZE,
  BRACKET_THICKNESS,
  RETICLE_RADIUS,
  HEX_SIZE,
  BORDER_WIDTH,
  type RarityPalette,
} from "./frame-config";

type Ctx = ReturnType<Canvas["getContext"]>;

// ─── Individual Draw Functions ────────────────────────────────────────────────

export function drawBackground(ctx: Ctx): void {
  ctx.fillStyle = "#080c14";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

export function drawHexGrid(ctx: Ctx, palette: RarityPalette): void {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 1;

  const hexH = HEX_SIZE * 2;
  const hexW = Math.sqrt(3) * HEX_SIZE;
  const cols = Math.ceil(CARD_WIDTH / hexW) + 2;
  const rows = Math.ceil(CARD_HEIGHT / hexH) + 2;

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const offsetX = row % 2 === 0 ? 0 : hexW / 2;
      const cx = col * hexW + offsetX;
      const cy = row * (hexH * 0.75);
      drawHex(ctx, cx, cy, HEX_SIZE);
    }
  }

  ctx.restore();
}

function drawHex(ctx: Ctx, cx: number, cy: number, size: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.stroke();
}

export function drawBorder(ctx: Ctx, palette: RarityPalette): void {
  ctx.save();
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = BORDER_WIDTH;
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 8;
  ctx.strokeRect(
    BORDER_WIDTH / 2,
    BORDER_WIDTH / 2,
    CARD_WIDTH - BORDER_WIDTH,
    CARD_HEIGHT - BORDER_WIDTH
  );
  ctx.restore();
}

export function drawCornerBrackets(ctx: Ctx, palette: RarityPalette): void {
  ctx.save();
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = BRACKET_THICKNESS;
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 6;

  const inset = BORDER_WIDTH + 4;
  const corners: [number, number, number, number][] = [
    [inset, inset, 1, 1],
    [CARD_WIDTH - inset, inset, -1, 1],
    [inset, CARD_HEIGHT - inset, 1, -1],
    [CARD_WIDTH - inset, CARD_HEIGHT - inset, -1, -1],
  ];

  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x + dx * BRACKET_SIZE, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * BRACKET_SIZE);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawReticle(ctx: Ctx, palette: RarityPalette): void {
  const cx = PHOTO_X + PHOTO_WIDTH / 2;
  const cy = PHOTO_Y + PHOTO_HEIGHT / 2;

  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 1.5;

  // Main circle
  ctx.beginPath();
  ctx.arc(cx, cy, RETICLE_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // Inner circle
  ctx.beginPath();
  ctx.arc(cx, cy, RETICLE_RADIUS * 0.4, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshairs
  const crossLen = RETICLE_RADIUS * 1.6;
  const gap = RETICLE_RADIUS * 0.55;

  ctx.beginPath();
  // Horizontal
  ctx.moveTo(cx - crossLen, cy);
  ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy);
  ctx.lineTo(cx + crossLen, cy);
  // Vertical
  ctx.moveTo(cx, cy - crossLen);
  ctx.lineTo(cx, cy - gap);
  ctx.moveTo(cx, cy + gap);
  ctx.lineTo(cx, cy + crossLen);
  ctx.stroke();

  ctx.restore();
}

export function drawScanLine(ctx: Ctx, palette: RarityPalette): void {
  const y = PHOTO_Y + PHOTO_HEIGHT * 0.4;
  const gradient = ctx.createLinearGradient(PHOTO_X, y, PHOTO_X + PHOTO_WIDTH, y);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.2, palette.glow);
  gradient.addColorStop(0.5, palette.primary);
  gradient.addColorStop(0.8, palette.glow);
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = gradient;
  ctx.fillRect(PHOTO_X, y - 1, PHOTO_WIDTH, 3);
  ctx.restore();
}

export function drawHudReadouts(ctx: Ctx, palette: RarityPalette): void {
  ctx.save();
  ctx.font = "10px monospace";
  ctx.globalAlpha = 0.7;

  const leftX = PHOTO_X + 8;
  const rightX = PHOTO_X + PHOTO_WIDTH - 8;
  const topY = PHOTO_Y + 16;
  const bottomY = PHOTO_Y + PHOTO_HEIGHT - 10;

  // Left side readouts
  ctx.fillStyle = palette.text;
  ctx.textAlign = "left";
  ctx.fillText("SYS ONLINE", leftX, topY);
  ctx.fillText("TGT LOCK", leftX, bottomY);

  // Right side readouts
  ctx.textAlign = "right";
  ctx.fillText("FRAME 00", rightX, topY);
  ctx.fillText("SCAN OK", rightX, bottomY);

  ctx.restore();
}

export function drawHeader(ctx: Ctx, palette: RarityPalette): void {
  // Header background
  ctx.save();
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, CARD_WIDTH, HEADER_HEIGHT + PHOTO_PADDING);

  // Bottom edge line
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(PHOTO_PADDING, HEADER_HEIGHT + PHOTO_PADDING);
  ctx.lineTo(CARD_WIDTH - PHOTO_PADDING, HEADER_HEIGHT + PHOTO_PADDING);
  ctx.stroke();
  ctx.restore();

  // "GundariuM" text
  ctx.save();
  ctx.fillStyle = palette.primary;
  ctx.font = `bold 18px "Orbitron", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 10;
  ctx.fillText("GundariuM", CARD_WIDTH / 2, (HEADER_HEIGHT + PHOTO_PADDING) / 2);
  ctx.restore();
}

export interface WeaponData {
  label: string;
  name: string;
  damage: number;
}

export function drawNameplate(
  ctx: Ctx,
  palette: RarityPalette,
  suitName: string,
  rarity: Rarity,
  pilotName: string,
  hp: number,
  armorType: string,
  weapons: WeaponData[]
): void {
  const plateY = CARD_HEIGHT - NAMEPLATE_HEIGHT - PHOTO_PADDING;
  const textX = PHOTO_PADDING + 8;
  const rightX = CARD_WIDTH - PHOTO_PADDING - 8;

  // Nameplate background
  ctx.save();
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, plateY, CARD_WIDTH, NAMEPLATE_HEIGHT + PHOTO_PADDING);

  // Top edge line
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(PHOTO_PADDING, plateY);
  ctx.lineTo(CARD_WIDTH - PHOTO_PADDING, plateY);
  ctx.stroke();
  ctx.restore();

  let y = plateY + 24;

  // Row 1: Suit name
  ctx.save();
  ctx.fillStyle = palette.text;
  ctx.font = `bold 16px "Orbitron", monospace`;
  ctx.textAlign = "left";
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 6;
  ctx.fillText(suitName, textX, y);
  ctx.restore();

  y += 20;

  // Row 2: Pilot + Armor type
  ctx.save();
  ctx.font = "10px monospace";
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "left";
  ctx.fillText(`PILOT: ${pilotName.toUpperCase()}`, textX, y);
  ctx.fillStyle = palette.primary;
  ctx.globalAlpha = 0.8;
  ctx.textAlign = "right";
  ctx.fillText(armorType.toUpperCase(), rightX, y);
  ctx.restore();

  y += 16;

  // Divider line
  ctx.save();
  ctx.strokeStyle = palette.primary;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(textX, y);
  ctx.lineTo(rightX, y);
  ctx.stroke();
  ctx.restore();

  y += 16;

  // Row 3: Rarity + HP
  ctx.save();
  ctx.fillStyle = palette.primary;
  ctx.font = `bold 12px "Orbitron", monospace`;
  ctx.textAlign = "left";
  ctx.fillText(rarity.toUpperCase(), textX, y);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`HP ${hp}`, rightX, y);
  ctx.restore();

  y += 14;

  // Divider line
  ctx.save();
  ctx.strokeStyle = palette.primary;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(textX, y);
  ctx.lineTo(rightX, y);
  ctx.stroke();
  ctx.restore();

  y += 16;

  // Row 4: Weapons (2-column grid)
  const midX = CARD_WIDTH / 2;
  for (let i = 0; i < weapons.length; i++) {
    const w = weapons[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const wx = col === 0 ? textX : midX + 4;
    const dmgX = col === 0 ? midX - 8 : rightX;
    const wy = y + row * 16;

    ctx.save();
    // Label
    ctx.font = "bold 9px monospace";
    ctx.fillStyle = palette.primary;
    ctx.globalAlpha = 0.7;
    ctx.textAlign = "left";
    ctx.fillText(w.label, wx, wy);
    // Weapon name
    ctx.fillStyle = "#94a3b8";
    ctx.globalAlpha = 1;
    ctx.font = "9px monospace";
    ctx.fillText(w.name, wx + 28, wy);
    // Damage
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(String(w.damage), dmgX, wy);
    ctx.restore();
  }

  y += Math.ceil(weapons.length / 2) * 16 + 8;

  // GundariuM seal
  ctx.save();
  ctx.fillStyle = palette.primary;
  ctx.globalAlpha = 0.5;
  ctx.font = `bold 8px "Orbitron", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("\u25C6 GUNDARIUM \u25C6", CARD_WIDTH / 2, y);
  ctx.restore();
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export interface RenderCardInput {
  photoBuffer: Buffer;
  suitName: string;
  rarity: Rarity;
  pilotName: string;
  hp: number;
  armorType: string;
  weapons: WeaponData[];
  palette: RarityPalette;
}

export async function renderCard(input: RenderCardInput): Promise<Buffer> {
  const { photoBuffer, suitName, rarity, pilotName, hp, armorType, weapons, palette } = input;

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext("2d");

  // 1. Background
  drawBackground(ctx);

  // 2. Hex grid overlay
  drawHexGrid(ctx, palette);

  // 3. Place user's photo (cover-fit into photo area)
  const photo = await loadImage(photoBuffer);
  const srcAspect = photo.width / photo.height;
  const dstAspect = PHOTO_WIDTH / PHOTO_HEIGHT;

  let sx = 0;
  let sy = 0;
  let sw = photo.width;
  let sh = photo.height;

  if (srcAspect > dstAspect) {
    // Photo is wider — crop sides
    sw = photo.height * dstAspect;
    sx = (photo.width - sw) / 2;
  } else {
    // Photo is taller — crop top/bottom
    sh = photo.width / dstAspect;
    sy = (photo.height - sh) / 2;
  }

  ctx.drawImage(photo, sx, sy, sw, sh, PHOTO_X, PHOTO_Y, PHOTO_WIDTH, PHOTO_HEIGHT);

  // 4. HUD overlays on top of photo
  drawReticle(ctx, palette);
  drawScanLine(ctx, palette);
  drawHudReadouts(ctx, palette);

  // 5. Corner brackets and border
  drawCornerBrackets(ctx, palette);
  drawBorder(ctx, palette);

  // 6. Header and nameplate
  drawHeader(ctx, palette);
  drawNameplate(ctx, palette, suitName, rarity, pilotName, hp, armorType, weapons);

  return Buffer.from(canvas.toBuffer("image/png"));
}
