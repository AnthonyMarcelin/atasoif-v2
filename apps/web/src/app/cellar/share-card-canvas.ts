import {
  categoryColor,
  SHARE_CARD_H,
  SHARE_CARD_W,
  SHARE_COLORS,
  SHARE_FONTS,
} from './share-card.tokens';
import { formatShareDate, inviteBannerHost, noteFilledBars } from './share-card-copy';
import type { CategoryMixItem, CellarLevelTitle } from './share-card-level';

export interface ShareCardBottleTile {
  name: string;
  origin: string | null;
  categorySlug: string | null;
  categoryLabel: string | null;
  /** Decoded image ready for drawImage, or null → striped placeholder. */
  image: CanvasImageSource | null;
}

export interface CaveShareCardInput {
  ownerLabel: string;
  caveTitle: string;
  bottleCount: number;
  levelTitle: CellarLevelTitle;
  categories: CategoryMixItem[];
  bottles: ShareCardBottleTile[];
  inviteUrl: string;
  date?: Date;
}

export interface BottleShareCardInput {
  name: string;
  origin: string | null;
  abvLabel: string | null;
  volumeLabel: string | null;
  vintage: string | null;
  categorySlug: string | null;
  categoryLabel: string | null;
  note: number | null;
  review: string | null;
  ownerLabel: string;
  inviteUrl: string;
  image: CanvasImageSource | null;
}

async function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.ready) {
    return;
  }
  try {
    await Promise.all([
      document.fonts.load(`800 72px ${SHARE_FONTS.display}`),
      document.fonts.load(`600 28px ${SHARE_FONTS.body}`),
      document.fonts.load(`700 22px ${SHARE_FONTS.mono}`),
      document.fonts.ready,
    ]);
  } catch {
    // System fallbacks still render.
  }
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_CARD_W;
  canvas.height = SHARE_CARD_H;
  return canvas;
}

function fillBg(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = SHARE_COLORS.bg;
  ctx.fillRect(0, 0, SHARE_CARD_W, SHARE_CARD_H);
}

function drawBrandMark(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const w = 36;
  const h = 52;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = SHARE_COLORS.ink;
  ctx.lineWidth = 2.5;
  ctx.fillStyle = SHARE_COLORS.accent;
  // Bottle silhouette (brand mark — not a user fill gauge).
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(24, 0);
  ctx.lineTo(24, 10);
  ctx.lineTo(30, 18);
  ctx.lineTo(30, 48);
  ctx.quadraticCurveTo(30, 52, 18, 52);
  ctx.quadraticCurveTo(6, 52, 6, 48);
  ctx.lineTo(6, 18);
  ctx.lineTo(12, 10);
  ctx.closePath();
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillRect(0, 28, w, h);
  ctx.restore();
  ctx.restore();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  rightLabel: string,
  y = 280,
): void {
  drawBrandMark(ctx, 72, y - 8);
  ctx.fillStyle = SHARE_COLORS.ink;
  ctx.font = `800 28px ${SHARE_FONTS.display}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('À TA SOIF', 122, y + 18);

  ctx.fillStyle = SHARE_COLORS.inkMuted;
  ctx.font = `700 22px ${SHARE_FONTS.mono}`;
  ctx.textAlign = 'right';
  ctx.fillText(rightLabel.toUpperCase(), SHARE_CARD_W - 72, y + 18);
}

function drawWrappedTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxLines: number,
  fontSize: number,
): number {
  ctx.fillStyle = SHARE_COLORS.ink;
  ctx.font = `800 ${fontSize}px ${SHARE_FONTS.display}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) {
        break;
      }
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  // If still overflowing last line, ellipsis truncate.
  if (words.length && lines.length === maxLines) {
    let last = lines[maxLines - 1] ?? '';
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    const consumed = lines.join(' ').length;
    const full = text.length;
    if (consumed < full) {
      lines[maxLines - 1] = `${last}…`;
    }
  }
  const lineHeight = fontSize * 0.95;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function drawHairline(ctx: CanvasRenderingContext2D, y: number): void {
  ctx.strokeStyle = SHARE_COLORS.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(72, y);
  ctx.lineTo(SHARE_CARD_W - 72, y);
  ctx.stroke();
}

function drawLevelStamp(
  ctx: CanvasRenderingContext2D,
  title: string,
  cx: number,
  cy: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-6 * Math.PI) / 180);
  ctx.font = `700 22px ${SHARE_FONTS.mono}`;
  const padX = 18;
  const padY = 14;
  const w = ctx.measureText(title).width + padX * 2;
  const h = 44;
  ctx.strokeStyle = SHARE_COLORS.accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = SHARE_COLORS.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 0, 1);
  ctx.restore();
}

function drawStripes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = SHARE_COLORS.surface;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = SHARE_COLORS.borderFaint;
  ctx.lineWidth = 2;
  const step = 18;
  for (let i = -h; i < w + h; i += step) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = SHARE_COLORS.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const iw =
    'naturalWidth' in image
      ? (image as HTMLImageElement).naturalWidth || (image as HTMLImageElement).width
      : (image as ImageBitmap).width;
  const ih =
    'naturalHeight' in image
      ? (image as HTMLImageElement).naturalHeight || (image as HTMLImageElement).height
      : (image as ImageBitmap).height;
  if (!iw || !ih) {
    drawStripes(ctx, x, y, w, h);
    return;
  }
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(image, dx, dy, dw, dh);
  ctx.restore();
  ctx.strokeStyle = SHARE_COLORS.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function drawCatStamp(
  ctx: CanvasRenderingContext2D,
  label: string,
  color: string,
  x: number,
  y: number,
  rotate = -4,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.font = `700 16px ${SHARE_FONTS.mono}`;
  const text = label.toUpperCase();
  const tw = ctx.measureText(text).width;
  const padX = 10;
  const padY = 8;
  const w = tw + padX * 2;
  const h = 28;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.fillStyle = SHARE_COLORS.bg;
  ctx.fillRect(-w, -h, w, h);
  ctx.strokeRect(-w, -h, w, h);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, -w / 2, -h / 2 + 1);
  ctx.restore();
}

function drawInviteBanner(
  ctx: CanvasRenderingContext2D,
  y: number,
  kicker: string,
  inviteUrl: string,
): void {
  const x = 72;
  const w = SHARE_CARD_W - 144;
  const h = 140;
  ctx.fillStyle = SHARE_COLORS.accent;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = SHARE_COLORS.onAccent;
  ctx.font = `700 18px ${SHARE_FONTS.mono}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(kicker.toUpperCase(), x + 28, y + 28);
  ctx.font = `800 36px ${SHARE_FONTS.display}`;
  ctx.fillText(inviteBannerHost(inviteUrl), x + 28, y + 68);
}

function drawNoteBars(
  ctx: CanvasRenderingContext2D,
  filled: number,
  x: number,
  y: number,
): void {
  const heights = [22, 30, 38, 46, 54];
  const barW = 14;
  const gap = 10;
  for (let i = 0; i < 5; i++) {
    const h = heights[i]!;
    const bx = x + i * (barW + gap);
    const by = y - h;
    if (i < filled) {
      ctx.fillStyle = i === filled - 1 ? SHARE_COLORS.accent : SHARE_COLORS.ink;
      ctx.fillRect(bx, by, barW, h);
    } else {
      ctx.strokeStyle = SHARE_COLORS.inkMuted;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, barW, h);
    }
  }
}

function drawMonMot(
  ctx: CanvasRenderingContext2D,
  review: string,
  x: number,
  y: number,
  maxWidth: number,
): number {
  ctx.fillStyle = SHARE_COLORS.inkMuted;
  ctx.font = `700 16px ${SHARE_FONTS.mono}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('MON MOT', x, y);

  const textY = y + 36;
  const barX = x;
  const textX = x + 22;
  const textW = maxWidth - 22;
  ctx.font = `500 28px ${SHARE_FONTS.body}`;
  ctx.fillStyle = SHARE_COLORS.ink2;

  const words = review.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= textW || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
      if (lines.length >= 4) {
        break;
      }
    }
  }
  if (current && lines.length < 4) {
    lines.push(current);
  }
  if (lines.length === 4) {
    let last = lines[3]!;
    while (last.length > 1 && ctx.measureText(`${last}…`).width > textW) {
      last = last.slice(0, -1);
    }
    if (words.join(' ').length > lines.join(' ').length) {
      lines[3] = `${last}…`;
    }
  }

  const lineH = 36;
  const blockH = Math.max(lineH * lines.length, 40);
  ctx.fillStyle = SHARE_COLORS.accent;
  ctx.fillRect(barX, textY, 4, blockH);
  ctx.fillStyle = SHARE_COLORS.ink2;
  lines.forEach((line, i) => {
    ctx.fillText(line, textX, textY + i * lineH);
  });
  return textY + blockH;
}

function drawBottleTile(
  ctx: CanvasRenderingContext2D,
  tile: ShareCardBottleTile,
  x: number,
  y: number,
  w: number,
  photoH: number,
): void {
  if (tile.image) {
    drawCoverImage(ctx, tile.image, x, y, w, photoH);
  } else {
    drawStripes(ctx, x, y, w, photoH);
  }
  const catLabel = tile.categoryLabel ?? tile.categorySlug;
  if (catLabel) {
    drawCatStamp(
      ctx,
      catLabel,
      categoryColor(tile.categorySlug),
      x + w - 8,
      y + photoH - 8,
    );
  }
  ctx.fillStyle = SHARE_COLORS.ink;
  ctx.font = `800 22px ${SHARE_FONTS.display}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const name = tile.name.toUpperCase();
  let display = name;
  while (display.length > 1 && ctx.measureText(display).width > w) {
    display = `${display.slice(0, -2)}…`;
  }
  ctx.fillText(display, x, y + photoH + 14);
  if (tile.origin) {
    ctx.fillStyle = SHARE_COLORS.inkMuted;
    ctx.font = `700 16px ${SHARE_FONTS.mono}`;
    ctx.fillText(tile.origin.toUpperCase(), x, y + photoH + 44);
  }
}

export async function renderCaveShareCard(input: CaveShareCardInput): Promise<Blob> {
  await waitForFonts();
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D indisponible');
  }
  fillBg(ctx);
  drawHeader(ctx, formatShareDate(input.date), 280);

  const titleEnd = drawWrappedTitle(ctx, input.caveTitle.toUpperCase(), 72, 360, 936, 2, 72);

  let y = Math.max(titleEnd + 36, 540);
  drawHairline(ctx, y);
  y += 36;

  const countLabel = String(input.bottleCount).padStart(2, '0');
  ctx.fillStyle = SHARE_COLORS.accent;
  ctx.font = `800 110px ${SHARE_FONTS.display}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(countLabel, 72, y + 90);
  const numW = ctx.measureText(countLabel).width;

  ctx.fillStyle = SHARE_COLORS.inkMuted;
  ctx.font = `700 20px ${SHARE_FONTS.mono}`;
  ctx.fillText('BOUTEILLES', 72 + numW + 28, y + 40);
  ctx.fillText('EN CAVE', 72 + numW + 28, y + 68);

  drawLevelStamp(ctx, input.levelTitle, SHARE_CARD_W - 220, y + 48);

  y += 120;
  drawHairline(ctx, y);
  y += 36;

  const few = input.bottleCount <= 3;
  if (!few && input.categories.length > 0) {
    let cx = 72;
    for (const cat of input.categories) {
      const label = `${cat.label} ${cat.count}`;
      ctx.font = `700 18px ${SHARE_FONTS.mono}`;
      const tw = ctx.measureText(label).width;
      const chipW = tw + 44;
      ctx.fillStyle = SHARE_COLORS.surface2;
      ctx.fillRect(cx, y, chipW, 40);
      ctx.fillStyle = cat.color;
      ctx.fillRect(cx + 12, y + 12, 14, 14);
      ctx.fillStyle = SHARE_COLORS.ink2;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx + 34, y + 21);
      cx += chipW + 12;
      if (cx > SHARE_CARD_W - 120) {
        break;
      }
    }
    y += 64;
  }

  const tiles = input.bottles.slice(0, few ? 3 : 6);
  if (few) {
    const gap = 24;
    const tileW = (SHARE_CARD_W - 144 - gap * 2) / 3;
    const photoH = tileW;
    tiles.forEach((tile, i) => {
      const x = 72 + i * (tileW + gap);
      drawBottleTile(ctx, tile, x, y, tileW, photoH);
    });
    y += photoH + 90;
  } else {
    const gap = 28;
    const cols = 2;
    const tileW = (SHARE_CARD_W - 144 - gap) / cols;
    const photoH = tileW * 0.85;
    tiles.forEach((tile, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 72 + col * (tileW + gap);
      const ty = y + row * (photoH + 88);
      drawBottleTile(ctx, tile, x, ty, tileW, photoH);
    });
    y += Math.ceil(tiles.length / cols) * (photoH + 88);
  }

  const bannerY = Math.min(Math.max(y + 24, 1520), 1600);
  drawInviteBanner(
    ctx,
    bannerY,
    'Viens voir ma cave · télécharge À ta soif',
    input.inviteUrl,
  );

  return canvasBlob(canvas);
}

export async function renderBottleShareCard(input: BottleShareCardInput): Promise<Blob> {
  await waitForFonts();
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D indisponible');
  }
  fillBg(ctx);
  drawHeader(ctx, 'Dans ma cave', 280);
  drawHairline(ctx, 340);

  let y = 380;
  const hasPhoto = Boolean(input.image);

  if (hasPhoto && input.image) {
    const photoW = SHARE_CARD_W - 144;
    const photoH = 720;
    drawCoverImage(ctx, input.image, 72, y, photoW, photoH);
    ctx.fillStyle = SHARE_COLORS.inkFaint;
    ctx.font = `700 16px ${SHARE_FONTS.mono}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('PHOTO BOUTEILLE', 88, y + photoH - 20);
    if (input.categoryLabel || input.categorySlug) {
      drawCatStamp(
        ctx,
        input.categoryLabel ?? input.categorySlug ?? '',
        categoryColor(input.categorySlug),
        72 + photoW - 16,
        y + photoH - 16,
        -3,
      );
    }
    y += photoH + 36;
  } else if (input.categoryLabel || input.categorySlug) {
    drawCatStamp(
      ctx,
      input.categoryLabel ?? input.categorySlug ?? '',
      categoryColor(input.categorySlug),
      200,
      y + 40,
      -6,
    );
    y += 70;
  }

  const nameSize = hasPhoto ? 56 : 64;
  const nameMaxLines = hasPhoto ? 2 : 4;
  y = drawWrappedTitle(ctx, input.name.toUpperCase(), 72, y, 936, nameMaxLines, nameSize);
  y += 20;

  const meta = [input.origin, input.vintage, input.abvLabel, input.volumeLabel]
    .map((p) => (p ? String(p).trim() : ''))
    .filter(Boolean)
    .join(' · ')
    .toUpperCase();
  if (meta) {
    ctx.fillStyle = SHARE_COLORS.ink2;
    ctx.font = `700 22px ${SHARE_FONTS.mono}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(meta, 72, y);
    y += 48;
  }

  drawHairline(ctx, y);
  y += 40;

  // MA NOTE
  ctx.strokeStyle = SHARE_COLORS.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(72, y, SHARE_CARD_W - 144, 88);
  ctx.fillStyle = SHARE_COLORS.inkMuted;
  ctx.font = `700 18px ${SHARE_FONTS.mono}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('MA NOTE', 100, y + 44);
  const filled = noteFilledBars(input.note);
  drawNoteBars(ctx, filled, SHARE_CARD_W - 72 - 140, y + 66);
  y += 120;

  if (input.review?.trim()) {
    y = drawMonMot(ctx, input.review.trim(), 72, y, SHARE_CARD_W - 144) + 40;
  }

  const bannerY = Math.min(Math.max(y + 20, 1520), 1600);
  const owner = input.ownerLabel.trim().toUpperCase() || 'MOI';
  const kicker = startsWithVowelForDe(owner)
    ? `Dans la cave d'${owner} · rejoins-moi`
    : `Dans la cave de ${owner} · rejoins-moi`;
  drawInviteBanner(ctx, bannerY, kicker, input.inviteUrl);

  return canvasBlob(canvas);
}

function startsWithVowelForDe(name: string): boolean {
  return /^[AEIOUYÀÂÄÆÉÈÊËÏÎÔŒÙÛÜ]/.test(name);
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Export PNG impossible'));
        }
      },
      'image/png',
      1,
    );
  });
}
