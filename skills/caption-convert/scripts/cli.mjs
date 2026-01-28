#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ASS_HEADER = `[Script Info]
Title: Converted from WebVTT
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1280
PlayResY: 720
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,LINE Seed TW_OTF Bold,48,&H0080FFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,2,0,2,1,1,20,1
Style: Secondary,Helvetica,12,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,2,1,1,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

const SUPPORTED_EXTS = new Set(['.srt', '.vtt', '.ass']);

function normalizeInput(content) {
  let text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  return text;
}

function splitWithLimit(text, delimiter, limit) {
  const parts = [];
  let current = '';
  let count = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === delimiter && count < limit - 1) {
      parts.push(current);
      current = '';
      count += 1;
    } else {
      current += char;
    }
  }

  parts.push(current);
  return parts;
}

function parseSrtVttTime(raw) {
  const clean = raw.trim().replace(',', '.');
  const pieces = clean.split('.');
  if (pieces.length !== 2) {
    return null;
  }

  const timePart = pieces[0];
  const msPart = pieces[1];
  if (!/^\d{1,3}$/.test(msPart)) {
    return null;
  }

  const timePieces = timePart.split(':');
  if (timePieces.length !== 2 && timePieces.length !== 3) {
    return null;
  }

  const numbers = timePieces.map((value) => Number(value));
  if (numbers.some((value) => Number.isNaN(value))) {
    return null;
  }

  const [hours, minutes, seconds] = timePieces.length === 3
    ? numbers
    : [0, numbers[0], numbers[1]];

  const ms = Number(msPart.padEnd(3, '0'));
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + ms;
}

function parseSrtVtt(content) {
  const normalized = normalizeInput(content);
  const blocks = normalized.split(/\n{2,}/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex === -1) {
      continue;
    }

    const timeLine = lines[timeIndex];
    const match = timeLine.match(/(.+?)\s*-->\s*(.+)/);
    if (!match) {
      continue;
    }

    const startRaw = match[1].trim();
    let endRaw = match[2].trim();
    endRaw = endRaw.split(/\s+/)[0];

    const start = parseSrtVttTime(startRaw);
    const end = parseSrtVttTime(endRaw);
    if (start === null || end === null) {
      continue;
    }

    const textLines = lines.slice(timeIndex + 1);
    const text = textLines.join('\n').replace(/\s+$/, '');
    cues.push({ start, end, text });
  }

  return cues;
}

function parseAssTime(raw) {
  const match = raw.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d{1,2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const cs = Number(match[4].padEnd(2, '0'));

  if ([hours, minutes, seconds, cs].some((value) => Number.isNaN(value))) {
    return null;
  }

  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + cs * 10;
}

function assToPlainText(text) {
  let cleaned = text.replace(/\{[^}]*\}/g, '');
  cleaned = cleaned.replace(/\\N/g, '\n');
  cleaned = cleaned.replace(/\\n/g, '\n');
  cleaned = cleaned.replace(/\\h/g, ' ');
  return cleaned;
}

function parseAss(content) {
  const normalized = normalizeInput(content);
  const lines = normalized.split('\n');
  const cues = [];
  let inEvents = false;
  let format = null;
  let indices = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inEvents = trimmed.toLowerCase() === '[events]';
      continue;
    }

    if (!inEvents) {
      continue;
    }

    if (trimmed.toLowerCase().startsWith('format:')) {
      format = trimmed.slice(7).split(',').map((part) => part.trim());
      indices = {
        start: format.findIndex((entry) => entry.toLowerCase() === 'start'),
        end: format.findIndex((entry) => entry.toLowerCase() === 'end'),
        text: format.findIndex((entry) => entry.toLowerCase() === 'text'),
      };
      continue;
    }

    if (!trimmed.toLowerCase().startsWith('dialogue:')) {
      continue;
    }

    if (!format || !indices || indices.start === -1 || indices.end === -1 || indices.text === -1) {
      continue;
    }

    const payload = trimmed.slice(9).trim();
    const fields = splitWithLimit(payload, ',', format.length);
    if (fields.length < format.length) {
      continue;
    }

    const start = parseAssTime(fields[indices.start] ?? '');
    const end = parseAssTime(fields[indices.end] ?? '');
    if (start === null || end === null) {
      continue;
    }

    const textRaw = fields[indices.text] ?? '';
    const text = assToPlainText(textRaw);
    cues.push({ start, end, text });
  }

  return cues;
}

function pad(value, size) {
  return String(value).padStart(size, '0');
}

function formatSrtTime(ms) {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`;
}

function formatVttTime(ms) {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
}

function formatAssTime(ms) {
  const totalCs = Math.max(0, Math.round(ms / 10));
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(cs, 2)}`;
}

function plainToAssText(text) {
  return text.replace(/\r/g, '').split('\n').join('\\N');
}

function renderSrt(cues) {
  const blocks = cues.map((cue, index) => {
    const text = cue.text ?? '';
    return `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${text}`;
  });

  return blocks.join('\n\n') + (blocks.length ? '\n' : '');
}

function renderVtt(cues) {
  const blocks = cues.map((cue) => {
    const text = cue.text ?? '';
    return `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${text}`;
  });

  return `WEBVTT\n\n${blocks.join('\n\n')}${blocks.length ? '\n' : ''}`;
}

function renderAss(cues) {
  const lines = [ASS_HEADER.trimEnd()];

  for (const cue of cues) {
    const text = plainToAssText(cue.text ?? '');
    lines.push(`Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Default,,0,0,0,,${text}`);
  }

  return `${lines.join('\n')}\n`;
}

function parseByExt(ext, content) {
  switch (ext) {
    case '.srt':
      return parseSrtVtt(content);
    case '.vtt':
      return parseSrtVtt(content);
    case '.ass':
      return parseAss(content);
    default:
      return [];
  }
}

function renderByExt(ext, cues) {
  switch (ext) {
    case '.srt':
      return renderSrt(cues);
    case '.vtt':
      return renderVtt(cues);
    case '.ass':
      return renderAss(cues);
    default:
      return '';
  }
}

function printUsage() {
  console.error('Usage: caption-convert [source] [target]');
  console.error('Supported formats: .srt, .vtt, .ass');
}

async function main() {
  const [, , source, target] = process.argv;

  if (!source || !target) {
    printUsage();
    process.exit(1);
  }

  const sourceExt = path.extname(source).toLowerCase();
  const targetExt = path.extname(target).toLowerCase();

  if (!SUPPORTED_EXTS.has(sourceExt) || !SUPPORTED_EXTS.has(targetExt)) {
    printUsage();
    process.exit(1);
  }

  const input = await fs.readFile(source, 'utf8');
  const cues = parseByExt(sourceExt, input);
  const output = renderByExt(targetExt, cues);

  await fs.writeFile(target, output, 'utf8');
}

main().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exit(1);
});
