import React, { useRef, useEffect, useState } from 'react';
import { WolfConfig, WOLF_ANIMATIONS, WARRIOR_ANIMATIONS, ELF_ANIMATIONS, MAGE_ANIMATIONS, MONSTER_ANIMATIONS, HUMANOID_ANIMATIONS, WolfAnimationType, WarriorAnimationType, AnimationDefinition } from '../types';
import { drawWolf } from '../utils/wolfDrawing';
import { drawWarrior } from '../utils/warriorDrawing';
import { drawElf } from '../utils/elfDrawing';
import { drawMage } from '../utils/mageDrawing';
import { drawMonster } from '../utils/monsterDrawing';
import { drawHumanoid } from '../utils/humanoidDrawing';
import { Download, ZoomIn, ZoomOut, Maximize2, Layers, Check, Copy, Crosshair, FolderArchive, ArrowRight, Sparkles, Sliders } from 'lucide-react';
import JSZip from 'jszip';

interface SpritesheetPanelProps {
  config: WolfConfig;
  currentAnimation: string;
  currentFrame: number;
}

export const SpritesheetPanel: React.FC<SpritesheetPanelProps> = ({
  config,
  currentAnimation,
  currentFrame,
}) => {
  const activeChar = config.characterType || 'wolf';
  const animsDict: Record<string, AnimationDefinition> = 
    activeChar === 'humanoid' ? { ...HUMANOID_ANIMATIONS, ...(config.customAnimations || {}) } :
    (activeChar === 'warrior' || activeChar === 'dwarf') ? (WARRIOR_ANIMATIONS as any) : 
    activeChar === 'elf' ? (ELF_ANIMATIONS as any) :
    activeChar === 'mage' ? (MAGE_ANIMATIONS as any) :
    activeChar === 'monster' ? (MONSTER_ANIMATIONS as any) :
    (WOLF_ANIMATIONS as any);
  
  const animationRows = Object.values(animsDict as any).sort((a: any, b: any) => a.row - b.row) as any[];
  const maxFrames = Math.max(...animationRows.map((r: any) => r.frameCount), 8); // dynamic frame counts
  const rowCount = animationRows.length;

  // Safe animation state selector preview tracking
  const currentAnimDef = animsDict[currentAnimation as any] || Object.values(animsDict)[0];
  const activeCol = currentFrame % (currentAnimDef?.frameCount || 6);
  const activeRow = currentAnimDef?.row || 0;
  const gridRes = config.resolution;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [bgType, setBgType] = useState<'transparent' | 'dark' | 'green' | 'grid'>('grid');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [sheetWidth, setSheetWidth] = useState<number>(0);
  const [sheetHeight, setSheetHeight] = useState<number>(0);

  // Hover Magnifier state definitions
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    col: number;
    row: number;
    animName: string;
    animType: string;
    frameCount: number;
    colX: number;
    rowY: number;
    mouseX: number;
    mouseY: number;
    isValidFrame: boolean;
  } | null>(null);

  const inspectorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [inspectorMag, setInspectorMag] = useState<number>(4); // default 4x magnification
  const [showInspectorGrid, setShowInspectorGrid] = useState<boolean>(true);

  // Locked/Pinned Cell state for dedicated gear/alignment desk
  const [lockedCell, setLockedCell] = useState<{
    col: number;
    row: number;
    animName: string;
    animType: string;
    frameCount: number;
    colX: number;
    rowY: number;
    isValidFrame: boolean;
  } | null>(null);

  // Inspector Alignment Desk states
  const deskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [deskZoom, setDeskZoom] = useState<number>(6); // high magnification, default 6x
  const [showDeskRulers, setShowDeskRulers] = useState<boolean>(true);
  const [deskRulerX, setDeskRulerX] = useState<number>(32); // Default to half of 64
  const [deskRulerY, setDeskRulerY] = useState<number>(32);
  const [onionSkinType, setOnionSkinType] = useState<'none' | 'prev' | 'next'>('none');
  const [onionSkinOpacity, setOnionSkinOpacity] = useState<number>(0.4);
  const [deskBg, setDeskBg] = useState<'transparent' | 'grid' | 'dark' | 'bright'>('grid');

  // Custom uploaded body/fx file observers for Spritesheet compilation
  const uploadedBodyImageRef = useRef<HTMLImageElement | null>(null);
  const uploadedFxImageRef = useRef<HTMLImageElement | null>(null);
  const [bImageLoaded, setBImageLoaded] = useState<number>(0);
  const [fImageLoaded, setFImageLoaded] = useState<number>(0);

  useEffect(() => {
    const half = Math.floor(config.resolution / 2);
    setDeskRulerX(half);
    setDeskRulerY(half);
  }, [config.resolution]);

  // Mouse move handler for computing and clamping coordinates over canvas
  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();

    const canvasX = Math.max(0, Math.min(canvas.width, ((e.clientX - canvasRect.left) / canvasRect.width) * canvas.width));
    const canvasY = Math.max(0, Math.min(canvas.height, ((e.clientY - canvasRect.top) / canvasRect.height) * canvas.height));

    const res = config.resolution;
    const col = Math.floor(canvasX / res);
    const row = Math.floor(canvasY / res);

    if (col >= 0 && col < maxFrames && row >= 0 && row < rowCount) {
      const anim = animationRows.find((r) => r.row === row);
      if (anim) {
        setHoveredCell({
          col,
          row,
          animName: anim.name,
          animType: anim.type,
          frameCount: anim.frameCount,
          colX: col * res,
          rowY: row * res,
          mouseX: x,
          mouseY: y,
          isValidFrame: col < anim.frameCount,
        });
        return;
      }
    }
    setHoveredCell(null);
  };

  // Click handler to select and pin a specific sprite cell for alignment debugging
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();

    const canvasX = Math.max(0, Math.min(canvas.width, ((e.clientX - canvasRect.left) / canvasRect.width) * canvas.width));
    const canvasY = Math.max(0, Math.min(canvas.height, ((e.clientY - canvasRect.top) / canvasRect.height) * canvas.height));

    const res = config.resolution;
    const col = Math.floor(canvasX / res);
    const row = Math.floor(canvasY / res);

    if (col >= 0 && col < maxFrames && row >= 0 && row < rowCount) {
      const anim = animationRows.find((r) => r.row === row);
      if (anim) {
        const isAlreadyLocked = lockedCell && lockedCell.col === col && lockedCell.row === row;
        if (isAlreadyLocked) {
          setLockedCell(null);
        } else {
          setLockedCell({
            col,
            row,
            animName: anim.name,
            animType: anim.type,
            frameCount: anim.frameCount,
            colX: col * res,
            rowY: row * res,
            isValidFrame: col < anim.frameCount,
          });
        }
      }
    }
  };

  // Helper styles to calculate visual HUD card bounds inside the container viewport (significantly larger preview)
  const getHudStyle = () => {
    if (!hoveredCell || !containerRef.current) return { display: 'none' };
    const container = containerRef.current;
    const cWidth = container.clientWidth;
    const cHeight = container.clientHeight;
    
    const hudW = 270;
    const hudH = 360;
    let left = hoveredCell.mouseX + 20;
    let top = hoveredCell.mouseY + 10;

    // Boundary flip condition
    if (left + hudW > cWidth) {
      left = hoveredCell.mouseX - hudW - 20;
    }
    if (top + hudH > cHeight) {
      top = hoveredCell.mouseY - hudH - 10;
    }

    // Outer safe clamp margins
    left = Math.max(10, Math.min(cWidth - hudW - 10, left));
    top = Math.max(10, Math.min(cHeight - hudH - 10, top));

    return {
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  // Pixel-perfect rendering effect for magnifier panel canvas
  useEffect(() => {
    if (!hoveredCell || !inspectorCanvasRef.current || !canvasRef.current) return;
    const ic = inspectorCanvasRef.current;
    const mc = canvasRef.current;
    const ictx = ic.getContext('2d');
    if (!ictx) return;

    const res = config.resolution;
    ic.width = res * inspectorMag;
    ic.height = res * inspectorMag;

    ictx.imageSmoothingEnabled = false; // Disable smooth scale filter for pixel art
    ictx.clearRect(0, 0, ic.width, ic.height);

    // Draw frame subset on inspector canvas
    ictx.drawImage(
      mc,
      hoveredCell.colX, hoveredCell.rowY, res, res,
      0, 0, ic.width, ic.height
    );

    // Crosshairs and custom reticle markers
    if (showInspectorGrid) {
      ictx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
      ictx.lineWidth = 1;

      ictx.beginPath();
      ictx.moveTo(ic.width / 2, 0);
      ictx.lineTo(ic.width / 2, ic.height);
      ictx.moveTo(0, ic.height / 2);
      ictx.lineTo(ic.width, ic.height / 2);
      ictx.stroke();

      ictx.strokeStyle = 'rgba(99, 102, 241, 0.85)';
      ictx.strokeRect(0, 0, ic.width, ic.height);
    }
  }, [hoveredCell, inspectorMag, showInspectorGrid, config.resolution]);

  // Dedicated rendering of Locked Cell alignment analyzer
  useEffect(() => {
    const mainCanvas = canvasRef.current;
    const deskCanvas = deskCanvasRef.current;
    if (!mainCanvas || !deskCanvas) return;

    const ctx = deskCanvas.getContext('2d');
    if (!ctx) return;

    const res = config.resolution;
    
    // Determine which cell is currently focused for deep inspection
    // If no cell is locked, we can fallback to the current running animation's loop frame!
    let targetCol = 0;
    let targetRow = 0;
    let targetAnimName = 'Default State';
    let targetIsValid = true;
    let targetFrameCount = 6;

    if (lockedCell) {
      targetCol = lockedCell.col;
      targetRow = lockedCell.row;
      targetAnimName = lockedCell.animName;
      targetIsValid = lockedCell.isValidFrame;
      targetFrameCount = lockedCell.frameCount;
    } else if (currentAnimDef) {
      targetCol = activeCol;
      targetRow = activeRow;
      targetAnimName = currentAnimDef.name;
      targetIsValid = activeCol < currentAnimDef.frameCount;
      targetFrameCount = currentAnimDef.frameCount;
    }

    const tX = targetCol * res;
    const tY = targetRow * res;

    // Canvas size
    deskCanvas.width = res * deskZoom;
    deskCanvas.height = res * deskZoom;

    // Disable image smoothing for ultra-crisp retro pixel art
    ctx.imageSmoothingEnabled = false;

    // Clear background
    ctx.clearRect(0, 0, deskCanvas.width, deskCanvas.height);

    if (deskBg === 'dark') {
      ctx.fillStyle = '#111827'; // gray-900
      ctx.fillRect(0, 0, deskCanvas.width, deskCanvas.height);
    } else if (deskBg === 'bright') {
      ctx.fillStyle = '#f8fafc'; // slate-50
      ctx.fillRect(0, 0, deskCanvas.width, deskCanvas.height);
    } else if (deskBg === 'grid') {
      // Chessboard alpha grid inside desk
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, deskCanvas.width, deskCanvas.height);
      ctx.fillStyle = '#334155';
      const checkSize = (res * deskZoom) / 8;
      for (let y = 0; y < deskCanvas.height; y += checkSize) {
        for (let x = 0; x < deskCanvas.width; x += checkSize) {
          if (((Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0)) {
            ctx.fillRect(x, y, checkSize, checkSize);
          }
        }
      }
    }

    // --- DRAW ONION SKIN BACKDROP (PREVIOUS OR NEXT FRAME) ---
    if (onionSkinType !== 'none' && targetIsValid) {
      let onionCol = targetCol;
      if (onionSkinType === 'prev' && targetCol > 0) {
        onionCol = targetCol - 1;
      } else if (onionSkinType === 'next' && targetCol < targetFrameCount - 1) {
        onionCol = targetCol + 1;
      }

      if (onionCol !== targetCol) {
        ctx.save();
        ctx.globalAlpha = onionSkinOpacity;
        const oX = onionCol * res;
        ctx.drawImage(
          mainCanvas,
          oX, tY, res, res,
          0, 0, deskCanvas.width, deskCanvas.height
        );
        ctx.restore();
      }
    }

    // --- DRAW ACTIVE SPRITE INSIDE DESK ---
    if (targetIsValid) {
      ctx.save();
      ctx.drawImage(
        mainCanvas,
        tX, tY, res, res,
        0, 0, deskCanvas.width, deskCanvas.height
      );
      ctx.restore();
    } else {
      // Draw center warning of empty frame
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.fillRect(0, 0, deskCanvas.width, deskCanvas.height);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NO POSE ACTIVE', deskCanvas.width / 2, deskCanvas.height / 2);
    }

    // --- DRAW TARGET REFERENCE RULERS & MEASUREMENTS ---
    if (showDeskRulers) {
      const rx = (deskRulerX / res) * deskCanvas.width;
      const ry = (deskRulerY / res) * deskCanvas.height;

      // Draw high-contrast dashed guidelines
      ctx.lineWidth = 1.5;
      
      // Vertical Ruler
      ctx.strokeStyle = '#38bdf8'; // sky-400
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx, deskCanvas.height);
      ctx.stroke();

      // Horizontal Ruler
      ctx.strokeStyle = '#f43f5e'; // rose-500
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(deskCanvas.width, ry);
      ctx.stroke();

      ctx.setLineDash([]); // Reset line dash

      // Draw a tiny target anchor dot at their crossing point
      ctx.fillStyle = '#f59e0b'; // amber-500
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(rx, ry, 3.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }, [
    lockedCell,
    currentAnimation,
    currentFrame,
    deskZoom,
    showDeskRulers,
    deskRulerX,
    deskRulerY,
    onionSkinType,
    onionSkinOpacity,
    deskBg,
    config.resolution,
    activeCol,
    activeRow,
    currentAnimDef,
    bImageLoaded,
    fImageLoaded,
  ]);



  useEffect(() => {
    if (config.uploadedBodyPng) {
      const img = new Image();
      img.src = config.uploadedBodyPng;
      img.onload = () => {
        uploadedBodyImageRef.current = img;
        setBImageLoaded((prev) => prev + 1);
      };
    } else {
      uploadedBodyImageRef.current = null;
      setBImageLoaded(0);
    }
  }, [config.uploadedBodyPng]);

  useEffect(() => {
    if (config.uploadedFxPng) {
      const img = new Image();
      img.src = config.uploadedFxPng;
      img.onload = () => {
        uploadedFxImageRef.current = img;
        setFImageLoaded((prev) => prev + 1);
      };
    } else {
      uploadedFxImageRef.current = null;
      setFImageLoaded(0);
    }
  }, [config.uploadedFxPng]);

  // Body/fx file observers for Spritesheet compilation

  // States for Production Export processes
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<string>('');

  // Helper to draw a single, clean transparent animation strip
  const getTransparentAnimationStrip = (anim: any): string => {
    const res = config.resolution;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = anim.frameCount * res;
    tempCanvas.height = res;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return '';

    tempCtx.imageSmoothingEnabled = true;

    // Draw each frame cleanly inside separate transparente sequence
    for (let col = 0; col < anim.frameCount; col++) {
      const cellCenterX = col * res + res / 2;
      const cellCenterY = res * (activeChar === 'humanoid' || activeChar === 'warrior' || activeChar === 'dwarf' || activeChar === 'elf' || activeChar === 'mage' || activeChar === 'monster' ? 0.72 : 0.65);

      tempCtx.save();
      
      // Draw base character
      if (!config.hideBaseBody) {
        if (activeChar === 'humanoid') {
          drawHumanoid(tempCtx, config, anim.type as any, col, cellCenterX, cellCenterY);
        } else if (activeChar === 'warrior' || activeChar === 'dwarf') {
          drawWarrior(tempCtx, config, anim.type as any, col, cellCenterX, cellCenterY);
        } else if (activeChar === 'elf') {
          drawElf(tempCtx, config, anim.type as any, col, cellCenterX, cellCenterY);
        } else if (activeChar === 'mage') {
          drawMage(tempCtx, config, anim.type as any, col, cellCenterX, cellCenterY);
        } else if (activeChar === 'monster') {
          drawMonster(tempCtx, config, anim.type as any, col, cellCenterX, cellCenterY);
        } else {
          drawWolf(tempCtx, config, anim.type as any, col, cellCenterX, cellCenterY);
        }
      }

      // Bake custom body skin overlay
      if (uploadedBodyImageRef.current) {
        tempCtx.save();
        tempCtx.translate(cellCenterX, cellCenterY);
        const bScale = config.bodySize * (config.customBodyScale || 1.0);
        tempCtx.scale(bScale, bScale);
        
        const offX = config.customBodyOffsetX || 0;
        const offY = config.customBodyOffsetY || 0;
        tempCtx.translate(offX, offY);

        const img = uploadedBodyImageRef.current;
        if (config.uploadedBodyMode === 'spliced' || config.uploadedBodyMode === 'full_sheet') {
          const totalFramesInCustom = anim.frameCount;
          const frameWidth = img.width / totalFramesInCustom;
          const frameHeight = img.height;
          tempCtx.drawImage(
            img,
            (col % totalFramesInCustom) * frameWidth, 0, frameWidth, frameHeight,
            -frameWidth / 2, -frameHeight + 10, frameWidth, frameHeight
          );
        } else {
          tempCtx.drawImage(img, -img.width / 2, -img.height + 10, img.width, img.height);
        }
        tempCtx.restore();
      }

      // Bake custom strike FX
      if (config.bakeFxInExport && uploadedFxImageRef.current && col >= (config.customFxTriggerFrame || 0)) {
        const fxFrameIdx = col - (config.customFxTriggerFrame || 0);
        const maxF = config.customFxFrameCount || 1;
        if (fxFrameIdx < maxF) {
          tempCtx.save();
          tempCtx.translate(cellCenterX + 15, cellCenterY - 10);
          const scaleVal = config.customFxScale || 1.0;
          tempCtx.scale(scaleVal, scaleVal);
          tempCtx.translate(config.customFxOffsetX || 0, config.customFxOffsetY || 0);
          tempCtx.rotate(((config.customFxRotation || 0) * Math.PI) / 180);
          
          const img = uploadedFxImageRef.current;
          const frameWidth = img.width / maxF;
          const frameHeight = img.height;
          tempCtx.drawImage(
            img,
            fxFrameIdx * frameWidth, 0, frameWidth, frameHeight,
            -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight
          );
          tempCtx.restore();
        }
      }

      tempCtx.restore();
    }

    return tempCanvas.toDataURL('image/png');
  };

  // ZIP download process
  const downloadAllStripsAsZip = async () => {
    setIsZipping(true);
    setZipProgress('Подготовка кадров...');
    try {
      const zip = new JSZip();

      for (let i = 0; i < animationRows.length; i++) {
        const anim = animationRows[i];
        setZipProgress(`Экспорт: ${anim.name}...`);
        
        const dataUrl = getTransparentAnimationStrip(anim);
        if (!dataUrl) continue;

        const base64Data = dataUrl.split(',')[1];
        zip.file(`${anim.type}.png`, base64Data, { base64: true });
      }

      setZipProgress('Сжатие архива...');
      const content = await zip.generateAsync({ type: 'blob' });
      
      const link = document.createElement('a');
      link.download = `${config.characterType}_clean_strips_export.zip`;
      link.href = URL.createObjectURL(content);
      link.click();
      setZipProgress('Готово!');
    } catch (err) {
      console.error(err);
      setZipProgress('Ошибка генерации');
    } finally {
      setTimeout(() => {
        setIsZipping(false);
        setZipProgress('');
      }, 2000);
    }
  };

  // Download clean full spritesheet (without helper overlays, lines, texts, chrome grids)
  const downloadCleanSpritesheet = () => {
    const res = config.resolution;
    const w = maxFrames * res;
    const h = rowCount * res;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.imageSmoothingEnabled = true;

    animationRows.forEach((anim: any) => {
      const rowY = anim.row * res;
      for (let col = 0; col < anim.frameCount; col++) {
        const colX = col * res;
        const cellCenterX = colX + res / 2;
        const cellCenterY = rowY + res * (activeChar === 'humanoid' || activeChar === 'warrior' || activeChar === 'dwarf' || activeChar === 'elf' || activeChar === 'mage' || activeChar === 'monster' ? 0.72 : 0.65);

        tempCtx.save();
        
        if (!config.hideBaseBody) {
          if (activeChar === 'humanoid') {
            drawHumanoid(tempCtx, config, anim.type as any, col, cellCenterX, cellCenterY);
          } else if (activeChar === 'warrior' || activeChar === 'dwarf') {
            drawWarrior(tempCtx, config, anim.type as any, col, cellCenterX, cellCenterY);
          } else if (activeChar === 'elf') {
            drawElf(tempCtx, config, anim.type as any, col, cellCenterX, cellCenterY);
          } else if (activeChar === 'mage') {
            drawMage(tempCtx, config, anim.type as any, col, cellCenterX, cellCenterY);
          } else if (activeChar === 'monster') {
            drawMonster(tempCtx, config, anim.type as any, col, cellCenterX, cellCenterY);
          } else {
            drawWolf(tempCtx, config, anim.type as any, col, cellCenterX, cellCenterY);
          }
        }

        if (uploadedBodyImageRef.current) {
          tempCtx.save();
          tempCtx.translate(cellCenterX, cellCenterY);
          const bScale = config.bodySize * (config.customBodyScale || 1.0);
          tempCtx.scale(bScale, bScale);
          
          const offX = config.customBodyOffsetX || 0;
          const offY = config.customBodyOffsetY || 0;
          tempCtx.translate(offX, offY);

          const img = uploadedBodyImageRef.current;
          if (config.uploadedBodyMode === 'spliced' || config.uploadedBodyMode === 'full_sheet') {
            const totalFramesInCustom = anim.frameCount;
            const frameWidth = img.width / totalFramesInCustom;
            const frameHeight = img.height;
            tempCtx.drawImage(
              img,
              (col % totalFramesInCustom) * frameWidth, 0, frameWidth, frameHeight,
              -frameWidth / 2, -frameHeight + 10, frameWidth, frameHeight
            );
          } else {
            tempCtx.drawImage(img, -img.width / 2, -img.height + 10, img.width, img.height);
          }
          tempCtx.restore();
        }

        if (config.bakeFxInExport && uploadedFxImageRef.current && col >= (config.customFxTriggerFrame || 0)) {
          const fxFrameIdx = col - (config.customFxTriggerFrame || 0);
          const maxF = config.customFxFrameCount || 1;
          if (fxFrameIdx < maxF) {
            tempCtx.save();
            tempCtx.translate(cellCenterX + 15, cellCenterY - 10);
            const scaleVal = config.customFxScale || 1.0;
            tempCtx.scale(scaleVal, scaleVal);
            tempCtx.translate(config.customFxOffsetX || 0, config.customFxOffsetY || 0);
            tempCtx.rotate(((config.customFxRotation || 0) * Math.PI) / 180);
            
            const img = uploadedFxImageRef.current;
            const frameWidth = img.width / maxF;
            const frameHeight = img.height;
            tempCtx.drawImage(
              img,
              fxFrameIdx * frameWidth, 0, frameWidth, frameHeight,
              -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight
            );
            tempCtx.restore();
          }
        }
        
        tempCtx.restore();
      }
    });

    const dataUrl = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${config.characterType}_spritesheet_clean_${config.resolution}x${config.resolution}.png`;
    link.href = dataUrl;
    link.click();
  };

  const downloadSingleStrip = (anim: any) => {
    const dataUrl = getTransparentAnimationStrip(anim);
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `${config.characterType}_strip_${anim.type}_${anim.frameCount}f_${config.resolution}x${config.resolution}.png`;
    link.href = dataUrl;
    link.click();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const res = config.resolution;
    const w = maxFrames * res;
    const h = rowCount * res;

    canvas.width = w;
    canvas.height = h;
    setSheetWidth(w);
    setSheetHeight(h);

    ctx.imageSmoothingEnabled = true;

    // Clear background
    ctx.clearRect(0, 0, w, h);
    if (bgType === 'dark') {
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, w, h);
    } else if (bgType === 'green') {
      ctx.fillStyle = '#00ff00'; // Chromatype
      ctx.fillRect(0, 0, w, h);
    } else if (bgType === 'grid') {
      // Chessboard alpha grid
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#334155';
      const checkSize = res / 4;
      for (let y = 0; y < h; y += checkSize) {
        for (let x = 0; x < w; x += checkSize) {
          if (((x / checkSize) + (y / checkSize)) % 2 === 0) {
            ctx.fillRect(x, y, checkSize, checkSize);
          }
        }
      }
    }

    // Render each cell
    animationRows.forEach((anim: any) => {
      const rowY = anim.row * res;
      for (let col = 0; col < maxFrames; col++) {
        const colX = col * res;

        // Draw bounding box
        ctx.strokeStyle = '#47556940';
        ctx.lineWidth = 1;
        ctx.strokeRect(colX, rowY, res, res);

        // Frame indicator text
        ctx.fillStyle = '#94a3b860';
        ctx.font = '9px monospace';
        ctx.fillText(`C${col} R${anim.row}`, colX + 4, rowY + 12);

        // Render species if target frame holds active pose
        if (col < anim.frameCount) {
          ctx.save();
          
          const cellCenterX = colX + res / 2;
          const cellCenterY = rowY + res * (activeChar === 'humanoid' || activeChar === 'warrior' || activeChar === 'dwarf' || activeChar === 'elf' || activeChar === 'mage' || activeChar === 'monster' ? 0.72 : 0.65);

          if (!config.hideBaseBody) {
            if (activeChar === 'humanoid') {
              drawHumanoid(ctx, config, anim.type as any, col, cellCenterX, cellCenterY);
            } else if (activeChar === 'warrior' || activeChar === 'dwarf') {
              drawWarrior(ctx, config, anim.type as any, col, cellCenterX, cellCenterY);
            } else if (activeChar === 'elf') {
              drawElf(ctx, config, anim.type as any, col, cellCenterX, cellCenterY);
            } else if (activeChar === 'mage') {
              drawMage(ctx, config, anim.type as any, col, cellCenterX, cellCenterY);
            } else if (activeChar === 'monster') {
              drawMonster(ctx, config, anim.type as any, col, cellCenterX, cellCenterY);
            } else {
              drawWolf(ctx, config, anim.type as any, col, cellCenterX, cellCenterY);
            }
          }

          // --- BAKE CUSTOM BODY SKIN OVERLAY IN EXPORT SPREADSHEET ---
          if (uploadedBodyImageRef.current) {
            ctx.save();
            ctx.translate(cellCenterX, cellCenterY);
            
            const bScale = config.bodySize * (config.customBodyScale || 1.0);
            ctx.scale(bScale, bScale);
            
            const offX = config.customBodyOffsetX || 0;
            const offY = config.customBodyOffsetY || 0;
            ctx.translate(offX, offY);

            const img = uploadedBodyImageRef.current;
            if (config.uploadedBodyMode === 'spliced' || config.uploadedBodyMode === 'full_sheet') {
              const totalFramesInCustom = anim.frameCount;
              const frameWidth = img.width / totalFramesInCustom;
              const frameHeight = img.height;
              ctx.drawImage(
                img,
                (col % totalFramesInCustom) * frameWidth, 0, frameWidth, frameHeight,
                -frameWidth / 2, -frameHeight + 10, frameWidth, frameHeight
              );
            } else {
              ctx.drawImage(img, -img.width / 2, -img.height + 10, img.width, img.height);
            }
            ctx.restore();
          }

          // --- BAKE CUSTOM STRIKE FX IN EXPORT SPREADSHEET IF OPTION ENABLED ---
          if (config.bakeFxInExport && uploadedFxImageRef.current && col >= (config.customFxTriggerFrame || 0)) {
            const fxFrameIdx = col - (config.customFxTriggerFrame || 0);
            const maxF = config.customFxFrameCount || 1;
            if (fxFrameIdx < maxF) {
              ctx.save();
              ctx.translate(cellCenterX + 15, cellCenterY - 10);
              const scaleVal = config.customFxScale || 1.0;
              ctx.scale(scaleVal, scaleVal);
              ctx.translate(config.customFxOffsetX || 0, config.customFxOffsetY || 0);
              ctx.rotate(((config.customFxRotation || 0) * Math.PI) / 180);
              
              const img = uploadedFxImageRef.current;
              const frameWidth = img.width / maxF;
              const frameHeight = img.height;
              ctx.drawImage(
                img,
                fxFrameIdx * frameWidth, 0, frameWidth, frameHeight,
                -frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight
              );
              ctx.restore();
            }
          }
          
          ctx.restore();
        } else {
          // Draw diagonal line of empty slots
          ctx.strokeStyle = '#4755691f';
          ctx.beginPath();
          ctx.moveTo(colX, rowY);
          ctx.lineTo(colX + res, rowY + res);
          ctx.stroke();
        }
      }
    });

  }, [config, bgType, activeChar, animsDict, animationRows, maxFrames, rowCount, bImageLoaded, fImageLoaded]);

  const downloadSpritesheet = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${config.characterType}_spritesheet_${config.resolution}x${config.resolution}.png`;
    link.href = dataUrl;
    link.click();
  };

  const copyDataUri = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    navigator.clipboard.writeText(dataUrl).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };



  const characterNames: Record<string, string> = {
    wolf: 'Животное-Компаньон',
    warrior: 'Рыцарь',
    dwarf: 'Гном-Кузнец (Подгорный)',
    elf: 'Эльф-Лучник',
    mage: 'Маг-Человек',
    monster: 'Монстр-Бестия'
  };

  return (
    <div id="spritesheet-panel-root" className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
      
      {/* Panel header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2" id="spritesheet-title">
            <Layers className="w-5 h-5 text-indigo-400" id="icon-layers" />
            <span>Generated Spritesheet Grid ({characterNames[activeChar] || activeChar})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1" id="spritesheet-desc">
            Full {maxFrames} cols x {rowCount} rows ({maxFrames * rowCount} cells). Cell resolution is {gridRes}px.
          </p>
        </div>

        {/* Action options */}
        <div className="flex items-center flex-wrap gap-2" id="spritesheet-top-toolbar">
          <div className="flex bg-slate-950/60 p-1 rounded-lg border border-slate-800" id="bg-selector">
            {(['grid', 'transparent', 'dark', 'green'] as const).map((type) => (
              <button
                key={type}
                id={`btn-bg-${type}`}
                onClick={() => setBgType(type)}
                className={`py-1 px-2 text-[10px] uppercase tracking-wider font-bold rounded cursor-pointer transition-all ${
                  bgType === type
                    ? 'bg-slate-805 text-indigo-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Hover magnifier configuration controls */}
          <div className="flex items-center bg-slate-950/60 p-1 rounded-lg border border-slate-800 gap-1 animate-fade-in" id="hover-magnifier-options">
            <span className="text-[10px] text-indigo-400 font-extrabold px-1.5 flex items-center gap-1 select-none whitespace-nowrap">
              <Crosshair className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              HOVER INSPECTOR:
            </span>
            {([2, 4, 8, 12] as const).map((lvl) => (
              <button
                key={lvl}
                id={`btn-mag-${lvl}x`}
                type="button"
                onClick={() => setInspectorMag(lvl)}
                className={`py-0.5 px-2 text-[9px] font-mono font-bold rounded cursor-pointer transition-all ${
                  inspectorMag === lvl
                    ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-205 hover:bg-slate-900/55'
                }`}
                title={`Set Hover-Zoom scale to ${lvl}x`}
              >
                {lvl}x
              </button>
            ))}
            <div className="w-px h-3.5 bg-slate-800/80 mx-0.5" />
            <button
              id="btn-toggle-inspector-grid"
              type="button"
              onClick={() => setShowInspectorGrid((p) => !p)}
              className={`p-1 rounded cursor-pointer transition-all ${
                showInspectorGrid
                  ? 'text-indigo-455 hover:text-indigo-305'
                  : 'text-slate-550 hover:text-slate-350'
              }`}
              title={showInspectorGrid ? "Hide Grid Guide Reticle" : "Show Grid Guide Reticle"}
            >
              <Crosshair className={`w-3.5 h-3.5 ${showInspectorGrid ? 'opacity-100 text-indigo-400' : 'opacity-40 text-slate-550'}`} />
            </button>
          </div>

          <div className="flex bg-slate-950/60 p-1 rounded-lg border border-slate-800 gap-1" id="zoom-controls">
            <button
              id="btn-zoom-out"
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
              className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono text-slate-305 min-w-[36px] text-center flex items-center justify-center select-none" id="zoom-label">
              {Math.round(zoom * 100)}%
            </span>
            <button
              id="btn-zoom-in"
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
              className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            id="btn-copy-uri"
            onClick={copyDataUri}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/55 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer transition-all"
            title="Copy as Base64 Data URL"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Base64</span>
              </>
            )}
          </button>

          <button
            id="btn-download-spritesheet"
            onClick={downloadSpritesheet}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-505 text-xs font-semibold text-white cursor-pointer shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:translate-y-px transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>
        </div>
      </div>

      {/* Grid Canvas Panel viewport */}
      <div 
        ref={containerRef}
        onMouseMove={handleContainerMouseMove}
        onMouseLeave={() => setHoveredCell(null)}
        onClick={handleContainerClick}
        className="relative border border-slate-800 bg-slate-950 rounded-xl overflow-hidden min-h-[300px] h-[420px] flex items-center justify-center cursor-crosshair" 
        id="spritesheet-container"
        title="Click any cell to pin inside the alignment desk below"
      >
        
        <div
          className="absolute overflow-auto max-w-full max-h-full p-8 flex items-center justify-center"
          id="spritesheet-canvas-wrapper"
        >
          <div
            className="relative shadow-2xl border border-indigo-700/25 transition-all origin-center select-none"
            style={{
              transform: `scale(${zoom})`,
              imageRendering: 'auto',
            }}
            id="spritesheet-scaled-viewport"
          >
            <canvas
              ref={canvasRef}
              id="rendering-spritesheet-canvas"
              className="block rounded-sm"
              style={{
                width: sheetWidth,
                height: sheetHeight,
              }}
            />

            {/* Hovered cell overlay box */}
            {hoveredCell && (
              <div
                id="spritesheet-hover-overlay"
                className="absolute border-2 border-indigo-500 bg-indigo-500/10 pointer-events-none z-10"
                style={{
                  left: hoveredCell.col * gridRes,
                  top: hoveredCell.row * gridRes,
                  width: gridRes,
                  height: gridRes,
                }}
              >
                <div className="absolute -top-5 left-0 bg-indigo-650 text-[8px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm whitespace-nowrap">
                  C{hoveredCell.col} R{hoveredCell.row}
                </div>
              </div>
            )}

            {/* Locked/pinned cell overlay box */}
            {lockedCell && (
              <div
                id="spritesheet-lock-overlay"
                className="absolute border-2 border-amber-500 bg-amber-500/10 pointer-events-none z-20 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                style={{
                  left: lockedCell.col * gridRes,
                  top: lockedCell.row * gridRes,
                  width: gridRes,
                  height: gridRes,
                }}
              >
                <div className="absolute -bottom-5 right-0 bg-amber-600 text-[8px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm whitespace-nowrap">
                  📌 PINNED
                </div>
              </div>
            )}

            {/* Scanning highlight overlay box */}
            {currentAnimDef && (
              <div
                id="spritesheet-tracker-overlay"
                className="absolute border-[2.5px] border-red-500 bg-red-400/12 pointer-events-none transition-all duration-75 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                style={{
                  left: activeCol * gridRes,
                  top: activeRow * gridRes,
                  width: gridRes,
                  height: gridRes,
                }}
              >
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[7px] font-mono font-bold px-1 rounded-bl">
                  PLAY
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Legend row index map */}
        <div className="absolute bottom-3 left-3 flex flex-col gap-0.5 bg-slate-950/85 backdrop-blur border border-slate-800 p-2 rounded-lg pointer-events-none select-none max-w-xs md:max-w-md" id="map-legend">
          <span className="text-[9px] uppercase font-bold text-slate-405 tracking-wider mb-1 flex items-center gap-1">
            <Maximize2 className="w-2.5 h-2.5 text-red-400" />
            Spritesheet Row Map
          </span>
          {animationRows.map((row: any) => (
            <div key={row.row} className="flex items-center gap-1.5 text-[10px]" id={`row-legend-${row.type}`}>
              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-mono font-bold text-[8px] ${
                row.type === currentAnimation
                  ? 'bg-red-500 text-white font-black'
                  : 'bg-slate-800 text-slate-400'
               }`}>
                {row.row}
              </span>
              <span className={`font-medium ${
                row.type === currentAnimation ? 'text-indigo-300 font-bold' : 'text-slate-400'
              }`}>
                {row.name}
              </span>
              <span className="text-slate-650 font-mono">({row.frameCount} fn)</span>
            </div>
          ))}
        </div>

        {/* Floating Magnified Pixel Inspector HUD (Beefed up size) */}
        {hoveredCell && (
          <div
            id="pixel-inspector-hud"
            className="absolute z-40 bg-slate-950/95 border border-indigo-500/40 rounded-xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.85),0_0_15px_rgba(99,102,241,0.25)] flex flex-col gap-2.5 w-[250px] pointer-events-none select-none backdrop-blur-md text-slate-200 animate-fade-in transition-all duration-75"
            style={getHudStyle()}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
              <span className="text-[10px] uppercase font-extrabold text-indigo-400 tracking-wider flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                Pixel Inspector
              </span>
              <span className="font-mono text-[9px] text-slate-500">
                {config.resolution}px
              </span>
            </div>

            {/* Magnified Canvas preview (Significantly larger) */}
            <div className="relative border border-slate-800 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center aspect-square self-center" style={{ width: '210px', height: '210px' }}>
              <canvas
                ref={inspectorCanvasRef}
                className="block rounded"
                style={{
                  width: '100%',
                  height: '100%',
                  imageRendering: 'pixelated',
                }}
              />
              
              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-slate-950/85 rounded text-[8px] font-mono font-bold text-indigo-300 border border-slate-850">
                {inspectorMag}x Zoom
              </span>
              
              {!hoveredCell.isValidFrame && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-[1px] text-[10px] text-rose-450 uppercase font-black tracking-widest">
                  Empty Cell
                </div>
              )}
            </div>

            {/* Description metadata list */}
            <div className="flex flex-col gap-1 text-[10px] font-medium text-slate-300">
              <div className="flex justify-between border-b border-slate-900 pb-0.5">
                <span className="text-slate-500">Animation:</span>
                <span className="text-indigo-300 text-right truncate max-w-[145px] font-bold" title={hoveredCell.animName}>
                  {hoveredCell.animName}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-0.5">
                <span className="text-slate-500">Coordinates:</span>
                <span className="font-mono text-slate-200">Col {hoveredCell.col} Row {hoveredCell.row}</span>
              </div>
              <div className="flex justify-between pb-0.5">
                <span className="text-slate-500">Pose status:</span>
                <span className={hoveredCell.isValidFrame ? "text-emerald-400 font-bold" : "text-rose-450 font-bold"}>
                  {hoveredCell.isValidFrame ? "Active Sprite" : "Empty Slot"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Production Export Hub Section */}
      <div 
        id="production-export-hub" 
        className="bg-slate-950/30 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <FolderArchive className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest flex items-center gap-2">
                <span>Production Asset Packaging & Export Hub</span>
                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-extrabold px-1.5 py-0.5 rounded tracking-normal uppercase">Game Engine Ready</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Generate and download pristine, zero-margin transparent assets packaged for high-fidelity engine workflows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="export-zip-btn"
              onClick={downloadAllStripsAsZip}
              disabled={isZipping}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer select-none ${
                isZipping
                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-900/40 animate-pulse'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 text-white shadow-lg shadow-indigo-600/15 border border-indigo-500/20'
              }`}
            >
              <FolderArchive className="w-4 h-4" />
              <span>{isZipping ? zipProgress : '📦 DOWNLOAD ALL STRIPS (ZIP)'}</span>
            </button>

            <button
              id="export-clean-sheet-btn"
              onClick={downloadCleanSpritesheet}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 transition-all cursor-pointer"
              title="Download entire sheet cleanly with no helper outlines, grids, or background checkerboards"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>EXPORT CLEAN GRID (PNG)</span>
            </button>
          </div>
        </div>

        {/* Dynamic preview list of individual strips which can be downloaded one-by-one */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5" id="strip-export-grids">
          {animationRows.map((anim) => {
            return (
              <div 
                key={anim.type}
                className="bg-slate-900/60 p-3 rounded-xl border border-slate-850 flex flex-col justify-between gap-3 hover:border-slate-800/80 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-lg bg-indigo-950/80 border border-indigo-900 flex items-center justify-center text-[10px] font-mono font-bold text-indigo-300">
                      {anim.row}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">
                        {anim.name}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest font-mono">
                        {anim.type}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono bg-zinc-950 p-1 px-1.5 rounded border border-zinc-850">
                    {anim.frameCount} Frames
                  </span>
                </div>

                {/* Miniature strip row container representing what would be downloaded */}
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-900 overflow-hidden flex items-center justify-center h-11 relative" title={`${anim.name} strip preview`}>
                  <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none" />
                  
                  {/* Small preview block of character head or active pose */}
                  <span className="text-[9px] text-slate-500 font-mono italic">
                    {anim.frameCount}x{config.resolution}px strip unscaled
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => downloadSingleStrip(anim)}
                  className="w-full py-1 text-[10px] uppercase font-bold tracking-wider rounded-lg bg-slate-950 text-slate-405 border border-slate-800 hover:bg-slate-900 hover:text-indigo-300 hover:border-indigo-950 transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Strip</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Precision Alignment Desk */}
      <div 
        id="gear-inspector-desk" 
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/45 border border-slate-800/80 rounded-xl p-5 mt-4"
      >
        <div className="lg:col-span-12 flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
              <Crosshair className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest">
                High-Precision Gear Alignment Desk
              </h3>
              <p className="text-[11px] text-slate-400">
                Verify asset alignment, weapon positions, and custom skin overlays across consecutive frame steps.
              </p>
            </div>
          </div>
          
          {lockedCell ? (
            <div className="flex items-center gap-2 bg-amber-500/10 text-amber-300 text-xs px-3 py-1 rounded-full border border-amber-500/20 font-bold">
              <span>📌 INSPECTING CELL: Col {lockedCell.col} / Row {lockedCell.row} ({lockedCell.animName})</span>
              <button 
                onClick={() => setLockedCell(null)}
                className="hover:text-white font-extrabold cursor-pointer ml-1 text-[11px]"
                title="Unlock and follow live sequence frame"
              >
                ✕ Unlock
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-300 text-xs px-3 py-1 rounded-full border border-indigo-500/20 font-semibold">
              <span>🔄 SYSTEM LOOP FRAME: Col {activeCol} / Row {activeRow} ({currentAnimDef?.name})</span>
              <span className="text-[10px] text-slate-400 font-normal">(Click any grid cell above to pin and analyze)</span>
            </div>
          )}
        </div>

        {/* Left Section: Magnified interactive preview viewport */}
        <div className="lg:col-span-5 flex flex-col gap-3.5 items-center justify-center bg-slate-900/60 p-4 rounded-lg border border-slate-850">
          <span className="text-[10px] font-bold text-slate-400 self-start uppercase tracking-wider block">
            🔍 Magnified Alignment Sandbox
          </span>

          <div 
            className="relative border-2 border-slate-800 rounded-xl p-2 flex items-center justify-center transition-all shadow-md group overflow-hidden"
            style={{
              backgroundColor: deskBg === 'dark' ? '#0f172a' : deskBg === 'bright' ? '#f8fafc' : '#1e293b',
              width: '100%',
              maxWidth: '240px',
              aspectRatio: '1/1'
            }}
          >
            {/* Checker Chessboard Background pattern element if deskBg is 'grid' */}
            {deskBg === 'grid' && (
              <div className="absolute inset-0 opacity-10 pointer-events-none rounded-lg bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
            )}

            <canvas
              ref={deskCanvasRef}
              className="block rounded-lg shadow-sm"
              style={{
                width: '100%',
                height: '100%',
                imageRendering: 'pixelated', // Keeps pixel art perfect
              }}
            />

            {/* Quick helper reticle center guides */}
            <div className="absolute top-2 left-2 flex gap-1.5 pointer-events-none">
              <span className="text-[8px] font-mono bg-slate-950/85 px-1.5 py-0.5 rounded text-indigo-300 border border-slate-850">
                Scale: {deskZoom}x
              </span>
              <span className="text-[8px] font-mono bg-slate-950/85 px-1.5 py-0.5 rounded text-slate-350 border border-slate-850">
                Res: {config.resolution}px
              </span>
            </div>
          </div>

          {/* Micro-toolbar under preview */}
          <div className="flex justify-between items-center w-full gap-2 mt-1 flex-wrap">
            {/* Background picker */}
            <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-md text-[9px] gap-0.5">
              {(['grid', 'dark', 'bright'] as const).map((bg) => (
                <button
                  key={bg}
                  onClick={() => setDeskBg(bg)}
                  className={`px-1.5 py-0.5 rounded cursor-pointer capitalize font-bold ${
                    deskBg === bg ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>

            {/* Desk Zoom Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-400 font-mono">Zoom:</span>
              <input
                type="range"
                min="2"
                max="16"
                step="2"
                value={deskZoom}
                onChange={(e) => setDeskZoom(parseInt(e.target.value))}
                className="w-16 h-1 bg-slate-950 rounded accent-indigo-550 cursor-pointer"
                title="Magnification scale"
              />
              <span className="text-[9px] font-mono text-slate-300 min-w-[20px] font-bold">
                {deskZoom}x
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Deep alignment rulers and stepper control panels */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Alignment guide rulers module */}
          <div className="bg-slate-900/40 p-3.5 rounded-lg border border-slate-850 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                1. Visual Crosshair Alignment Guides
              </span>
              <input
                type="checkbox"
                checked={showDeskRulers}
                onChange={(e) => setShowDeskRulers(e.target.checked)}
                className="accent-indigo-500 w-3.5 h-3.5 cursor-pointer"
                id="toggle-desk-rulers"
              />
            </div>

            {showDeskRulers && (
              <div className="grid grid-cols-2 gap-3.5 text-xs text-slate-300 mt-0.5">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-sky-400 font-semibold font-mono">Vertical Guide (X):</span>
                    <span className="bg-slate-950 text-sky-300 font-mono px-1.5 py-0.5 rounded font-black border border-slate-850">
                      X = {deskRulerX}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={config.resolution}
                    step="1"
                    value={deskRulerX}
                    onChange={(e) => setDeskRulerX(parseInt(e.target.value))}
                    className="accent-sky-400 bg-slate-950 h-1 rounded cursor-pointer w-full"
                  />
                  <span className="text-[9px] text-slate-500 font-mono">
                    Horizontal offset from left edge
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-rose-450 font-semibold font-mono">Horizontal Guide (Y):</span>
                    <span className="bg-slate-950 text-rose-300 font-mono px-1.5 py-0.5 rounded font-black border border-slate-850">
                      Y = {deskRulerY}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={config.resolution}
                    step="1"
                    value={deskRulerY}
                    onChange={(e) => setDeskRulerY(parseInt(e.target.value))}
                    className="accent-rose-500 bg-slate-950 h-1 rounded cursor-pointer w-full"
                  />
                  <span className="text-[9px] text-slate-500 font-mono">
                    Vertical height offset from top edge
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Onion Skin Frame Transition Examiner */}
          <div className="bg-slate-900/40 p-3.5 rounded-lg border border-slate-850 flex flex-col gap-3">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              2. Semi-Transparent Onion Skinning
            </span>

            <div className="flex flex-wrap gap-2 items-center justify-between text-xs text-slate-300">
              <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-lg gap-1">
                {(['none', 'prev', 'next'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setOnionSkinType(mode)}
                    className={`py-1 px-2 rounded text-[10px] font-bold cursor-pointer uppercase transition-all ${
                      onionSkinType === mode
                        ? 'bg-indigo-650 text-white font-extrabold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                    }`}
                  >
                    {mode === 'none' ? 'Disabled' : mode === 'prev' ? '👈 Previous Frame' : '👉 Next Frame'}
                  </button>
                ))}
              </div>

              {onionSkinType !== 'none' && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-400 font-mono">Opacity:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={onionSkinOpacity}
                    onChange={(e) => setOnionSkinOpacity(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-slate-950 rounded accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-[9px] font-semibold text-indigo-300 bg-slate-950 px-1 rounded">
                    {Math.round(onionSkinOpacity * 100)}%
                  </span>
                </div>
              )}
            </div>
            
            <p className="text-[10px] text-slate-500">
              Overlay consecutive poses at low opacity to detect if character parts drift or shift out of line between frames.
            </p>
          </div>

          {/* Locked frame navigation pad */}
          <div className="bg-slate-900/40 p-3 flex items-center justify-between rounded-lg border border-slate-850 flex-wrap gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-wide">
                Rigger Stepper Keypad
              </span>
              <span className="text-[9px] text-slate-500">
                Cycle through cells to verify alignment across sequences
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-lg border border-slate-850 flex-wrap">
              <button
                onClick={() => {
                  let col = activeCol;
                  let row = activeRow;
                  if (lockedCell) {
                    col = lockedCell.col;
                    row = lockedCell.row;
                  }
                  const newCol = Math.max(0, col - 1);
                  const anim = animationRows.find((r) => r.row === row);
                  if (anim) {
                    setLockedCell({
                      col: newCol,
                      row,
                      animName: anim.name,
                      animType: anim.type,
                      frameCount: anim.frameCount,
                      colX: newCol * config.resolution,
                      rowY: row * config.resolution,
                      isValidFrame: newCol < anim.frameCount
                    });
                  }
                }}
                className="p-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded font-mono font-bold text-[10px] text-slate-300 hover:text-white cursor-pointer"
                title="Step Left (Previous Frame)"
              >
                ◀ Frame
              </button>
              
              <span className="text-[10px] font-mono font-black text-slate-400 px-1 text-center min-w-[32px]">
                C{(lockedCell || { col: activeCol }).col}
              </span>

              <button
                onClick={() => {
                  let col = activeCol;
                  let row = activeRow;
                  if (lockedCell) {
                    col = lockedCell.col;
                    row = lockedCell.row;
                  }
                  const anim = animationRows.find((r) => r.row === row);
                  if (anim) {
                    const newCol = Math.min(maxFrames - 1, col + 1);
                    setLockedCell({
                      col: newCol,
                      row,
                      animName: anim.name,
                      animType: anim.type,
                      frameCount: anim.frameCount,
                      colX: newCol * config.resolution,
                      rowY: row * config.resolution,
                      isValidFrame: newCol < anim.frameCount
                    });
                  }
                }}
                className="p-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded font-mono font-bold text-[10px] text-slate-300 hover:text-white cursor-pointer"
                title="Step Right (Next Frame)"
              >
                Frame ▶
              </button>

              <div className="w-px h-4 bg-slate-800/80 mx-1.5" />

              <button
                onClick={() => {
                  let col = activeCol;
                  let row = activeRow;
                  if (lockedCell) {
                    col = lockedCell.col;
                    row = lockedCell.row;
                  }
                  const newRow = Math.max(0, row - 1);
                  const anim = animationRows.find((r) => r.row === newRow);
                  if (anim) {
                    setLockedCell({
                      col,
                      row: newRow,
                      animName: anim.name,
                      animType: anim.type,
                      frameCount: anim.frameCount,
                      colX: col * config.resolution,
                      rowY: newRow * config.resolution,
                      isValidFrame: col < anim.frameCount
                    });
                  }
                }}
                className="p-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded font-mono font-bold text-[10px] text-slate-300 hover:text-white cursor-pointer"
                title="Step Up Row"
              >
                ▲ Row
              </button>

              <span className="text-[10px] font-mono font-black text-slate-400 px-1 text-center min-w-[32px]">
                R{(lockedCell || { row: activeRow }).row}
              </span>

              <button
                onClick={() => {
                  let col = activeCol;
                  let row = activeRow;
                  if (lockedCell) {
                    col = lockedCell.col;
                    row = lockedCell.row;
                  }
                  const newRow = Math.min(rowCount - 1, row + 1);
                  const anim = animationRows.find((r) => r.row === newRow);
                  if (anim) {
                    setLockedCell({
                      col,
                      row: newRow,
                      animName: anim.name,
                      animType: anim.type,
                      frameCount: anim.frameCount,
                      colX: col * config.resolution,
                      rowY: newRow * config.resolution,
                      isValidFrame: col < anim.frameCount
                    });
                  }
                }}
                className="p-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded font-mono font-bold text-[10px] text-slate-300 hover:text-white cursor-pointer"
                title="Step Down Row"
              >
                Row ▼
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
