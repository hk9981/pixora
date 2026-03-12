import { useEffect, useRef, useState } from "react"

const GRID = 40
const HANDLE = 8

export default function CanvasEditor({ elements, theme, snapToGrid, undo, redo, pushHistory }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  const selectedRef = useRef([])
  const draggingRef = useRef(false)
  const resizingRef = useRef(null)
  const hasMovedRef = useRef(false)
  const selectionBoxRef = useRef(null)
  
  const resizeDataRef = useRef(null)
  const elementsRef = useRef(elements)
  const offsetRef = useRef({ x: 0, y: 0 })

  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  const spaceHeld = useRef(false)
  const panning = useRef(false)

  const guideX = useRef(null)
  const guideY = useRef(null)
  const [editingText, setEditingText] = useState(null)
  const snapGridRef = useRef(snapToGrid)
  
  useEffect(() => { snapGridRef.current = snapToGrid }, [snapToGrid])
  useEffect(() => { elementsRef.current = elements }, [elements])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    let animationFrameId;

    window.selectedElement = selectedRef
    window.canvasElements = elementsRef
    window.imageCache = window.imageCache || {} 

    function resizeCanvas() {
      if (!canvas.parentElement) return
      canvas.width = canvas.parentElement.clientWidth
      canvas.height = canvas.parentElement.clientHeight
    }
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    function world(e) {
      return { x: (e.offsetX - panRef.current.x) / zoomRef.current, y: (e.offsetY - panRef.current.y) / zoomRef.current }
    }

    function isPointInElement(x, y, el) {
      let px = x, py = y;
      if (el.rotation) {
        const cx = el.x + el.width / 2, cy = el.y + el.height / 2, rad = (-el.rotation * Math.PI) / 180; 
        const dx = x - cx, dy = y - cy;
        px = dx * Math.cos(rad) - dy * Math.sin(rad) + cx;
        py = dx * Math.sin(rad) + dy * Math.cos(rad) + cy;
      }
      if (["rect", "image", "circle", "line"].includes(el.type)) return px >= el.x && px <= el.x + el.width && py >= el.y && py <= el.y + el.height;
      if (el.type === "text") {
        ctx.font = `${el.fontSize}px Inter, sans-serif`;
        const w = ctx.measureText(el.text).width, h = el.fontSize;
        el.width = w; el.height = h;
        return px >= el.x && px <= el.x + w && py >= el.y && py <= el.y + h;
      }
      return false;
    }

    function elementAt(x, y) {
      for (let i = elementsRef.current.length - 1; i >= 0; i--) {
        if (isPointInElement(x, y, elementsRef.current[i])) return elementsRef.current[i];
      }
      return null;
    }

    function handles(el) {
      if (el.type === 'line') return { l: [el.x, el.y + el.height / 2], r: [el.x + el.width, el.y + el.height / 2], rot: [el.x + el.width / 2, el.y - 30 / zoomRef.current] }
      return {
        tl: [el.x, el.y], tr: [el.x + el.width, el.y], bl: [el.x, el.y + el.height], br: [el.x + el.width, el.y + el.height],
        l: [el.x, el.y + el.height / 2], r: [el.x + el.width, el.y + el.height / 2], t: [el.x + el.width / 2, el.y], b: [el.x + el.width / 2, el.y + el.height],
        rot: [el.x + el.width / 2, el.y - 30 / zoomRef.current] 
      }
    }

    function detectHandle(mouse, el) {
      const cornerMargin = 24 / zoomRef.current; 
      const edgeMargin = 14 / zoomRef.current; 
      
      let mx = mouse.x, my = mouse.y;
      if (el.rotation) {
        const cx = el.x + el.width / 2, cy = el.y + el.height / 2, rad = (-el.rotation * Math.PI) / 180;
        mx = (mouse.x - cx) * Math.cos(rad) - (mouse.y - cy) * Math.sin(rad) + cx;
        my = (mouse.x - cx) * Math.sin(rad) + (mouse.y - cy) * Math.cos(rad) + cy;
      }

      const ex = el.x, ey = el.y, ew = el.width, eh = el.height;
      if (Math.abs(mx - (ex + ew / 2)) < cornerMargin && Math.abs(my - (ey - 30 / zoomRef.current)) < cornerMargin) return "rot";

      if (el.type !== 'line') {
        if (Math.abs(mx - ex) < cornerMargin && Math.abs(my - ey) < cornerMargin) return "tl";
        if (Math.abs(mx - (ex + ew)) < cornerMargin && Math.abs(my - ey) < cornerMargin) return "tr";
        if (Math.abs(mx - ex) < cornerMargin && Math.abs(my - (ey + eh)) < cornerMargin) return "bl";
        if (Math.abs(mx - (ex + ew)) < cornerMargin && Math.abs(my - (ey + eh)) < cornerMargin) return "br";
      }

      if (my >= ey && my <= ey + eh && Math.abs(mx - ex) < edgeMargin) return "l";
      if (my >= ey && my <= ey + eh && Math.abs(mx - (ex + ew)) < edgeMargin) return "r";
      if (el.type !== 'line') {
        if (mx >= ex && mx <= ex + ew && Math.abs(my - ey) < edgeMargin) return "t";
        if (mx >= ex && mx <= ex + ew && Math.abs(my - (ey + eh)) < edgeMargin) return "b";
      }
      return null;
    }

    function cursor(h, el) {
      if (h === "rot") return "crosshair";
      if (!el) return "default";
      const baseAngles = { t: 0, tr: 45, r: 90, br: 135, b: 180, bl: 225, l: 270, tl: 315 };
      if (baseAngles[h] === undefined) return "default";
      let angle = (baseAngles[h] + (el.rotation || 0)) % 360;
      if (angle < 0) angle += 360;
      const snap = Math.round(angle / 45) * 45 % 360;
      if (snap === 0 || snap === 180) return "ns-resize";
      if (snap === 45 || snap === 225) return "nesw-resize";
      if (snap === 90 || snap === 270) return "ew-resize";
      if (snap === 135 || snap === 315) return "nwse-resize";
      return "default";
    }
    
    function preventContextMenu(e) { e.preventDefault() }

    function mousedown(e) {
      if (e.button === 2 || spaceHeld.current) { panning.current = true; canvas.style.cursor = "grabbing"; return; }
      if (editingText) { setEditingText(prev => { if(prev) { prev.el.text = prev.text; prev.el.isEditing = false; pushHistory(JSON.parse(JSON.stringify(elementsRef.current))); } return null; }); }
      
      const mouse = world(e)
      let el = elementAt(mouse.x, mouse.y)
      if (!el && selectedRef.current.length === 1) { const handle = detectHandle(mouse, selectedRef.current[0]); if (handle) el = selectedRef.current[0]; }
      if (!el) { selectedRef.current = []; selectionBoxRef.current = { x: mouse.x, y: mouse.y, w: 0, h: 0 }; return; }
      
      if (el.groupId) {
        const groupMembers = elementsRef.current.filter(e => e.groupId === el.groupId);
        if (!e.shiftKey) selectedRef.current = groupMembers;
        else {
          const newSelection = [...selectedRef.current];
          groupMembers.forEach(member => { if (!newSelection.includes(member)) newSelection.push(member); });
          selectedRef.current = newSelection;
        }
      } else {
        if (!e.shiftKey && !selectedRef.current.includes(el)) selectedRef.current = [el]
        else if (e.shiftKey && !selectedRef.current.includes(el)) selectedRef.current.push(el)
      }

      const handle = detectHandle(mouse, el)
      if (handle) { 
        resizingRef.current = handle; 
        const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
        let fx = el.x, fy = el.y;
        if (handle === 'br') { fx = el.x; fy = el.y; } else if (handle === 'tl') { fx = el.x + el.width; fy = el.y + el.height; }
        else if (handle === 'tr') { fx = el.x; fy = el.y + el.height; } else if (handle === 'bl') { fx = el.x + el.width; fy = el.y; }
        else if (handle === 't') { fx = el.x + el.width / 2; fy = el.y + el.height; } else if (handle === 'b') { fx = el.x + el.width / 2; fy = el.y; }
        else if (handle === 'l') { fx = el.x + el.width; fy = el.y + el.height / 2; } else if (handle === 'r') { fx = el.x; fy = el.y + el.height / 2; }
        else if (handle === 'rot') { fx = cx; fy = cy; }

        let fwx = fx, fwy = fy;
        if (el.rotation) {
           const rad = (el.rotation * Math.PI) / 180;
           fwx = Math.cos(rad) * (fx - cx) - Math.sin(rad) * (fy - cy) + cx;
           fwy = Math.sin(rad) * (fx - cx) + Math.cos(rad) * (fy - cy) + cy;
        }
        resizeDataRef.current = { startX: el.x, startY: el.y, startW: el.width, startH: el.height, cx, cy, fx, fy, fwx, fwy };
        return; 
      }

      hasMovedRef.current = false; draggingRef.current = true;
      offsetRef.current.x = mouse.x - el.x; offsetRef.current.y = mouse.y - el.y;
      canvas.style.cursor = "grabbing";
    }

    function dblclick(e) {
      const mouse = world(e), el = elementAt(mouse.x, mouse.y);
      if (el && el.type === "text") {
        el.isEditing = true;
        setEditingText({ el, text: el.text, x: el.x * zoomRef.current + panRef.current.x, y: el.y * zoomRef.current + panRef.current.y, fontSize: el.fontSize * zoomRef.current, color: el.color || "#000" })
      }
    }

    function mousemove(e) {
      const mouse = world(e)
      if (panning.current) { panRef.current.x += e.movementX; panRef.current.y += e.movementY; return }

      if (selectionBoxRef.current) {
        selectionBoxRef.current.w = mouse.x - selectionBoxRef.current.x; selectionBoxRef.current.h = mouse.y - selectionBoxRef.current.y;
        const box = selectionBoxRef.current, rx = Math.min(box.x, mouse.x), ry = Math.min(box.y, mouse.y), rw = Math.abs(box.w), rh = Math.abs(box.h);
        selectedRef.current = elementsRef.current.filter(el => (el.x < rx + rw && el.x + el.width > rx && el.y < ry + rh && el.y + el.height > ry));
        return;
      }

      const el = selectedRef.current[0]
      let newCursor = "default"
      if (resizingRef.current) newCursor = cursor(resizingRef.current, el)
      else if (draggingRef.current) newCursor = "grabbing"
      else {
        const hoveredEl = elementAt(mouse.x, mouse.y)
        let handle = null
        if (el && selectedRef.current.includes(hoveredEl)) handle = detectHandle(mouse, el)
        if (!handle && el) handle = detectHandle(mouse, el); 
        if (handle) newCursor = cursor(handle, el); else if (hoveredEl) newCursor = "grab"
      }
      canvas.style.cursor = newCursor

      if (resizingRef.current && el) {
        const type = resizingRef.current

        if (type === "rot") {
          const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
          let deg = (Math.atan2(mouse.y - cy, mouse.x - cx) * 180) / Math.PI + 90; 
          if (deg < 0) deg += 360;
          if (e.shiftKey) deg = Math.round(deg / 15) * 15;
          el.rotation = deg;
          return;
        }

        const start = resizeDataRef.current;
        if (!start) return;

        let mx = mouse.x, my = mouse.y;
        if (el.rotation) {
          const rad = (-el.rotation * Math.PI) / 180, dx = mouse.x - start.cx, dy = mouse.y - start.cy;
          mx = dx * Math.cos(rad) - dy * Math.sin(rad) + start.cx;
          my = dx * Math.sin(rad) + dy * Math.cos(rad) + start.cy;
        }

        const minSize = el.type === 'line' ? 2 : 10;
        let newW = start.startW, newH = start.startH;
        let localNewX = start.startX, localNewY = start.startY;

        if (type === "br") { newW = mx - start.startX; newH = my - start.startY; }
        if (type === "tr") { newW = mx - start.startX; newH = start.startH + (start.startY - my); localNewY = my; }
        if (type === "bl") { newW = start.startW + (start.startX - mx); localNewX = mx; newH = my - start.startY; }
        if (type === "tl") { newW = start.startW + (start.startX - mx); newH = start.startH + (start.startY - my); localNewX = mx; localNewY = my; }
        if (type === "r")  { newW = mx - start.startX; }
        if (type === "l")  { newW = start.startW + (start.startX - mx); localNewX = mx; }
        if (type === "b")  { newH = my - start.startY; }
        if (type === "t")  { newH = start.startH + (start.startY - my); localNewY = my; }

        if (newW < minSize) { newW = minSize; if (['tl', 'bl', 'l'].includes(type)) localNewX = start.startX + start.startW - minSize; }
        if (newH < minSize) { newH = minSize; if (['tl', 'tr', 't'].includes(type)) localNewY = start.startY + start.startH - minSize; }

        if (el.type === 'circle' || (e.shiftKey && ['rect', 'image'].includes(el.type))) {
          let ratio = el.type === 'circle' ? 1 : (start.startW / start.startH);
          if (['tl', 'tr', 'bl', 'br'].includes(type)) {
            if (newW / ratio > newH) newH = newW / ratio;
            else newW = newH * ratio;
            
            if (type === 'tl') { localNewX = start.startX + start.startW - newW; localNewY = start.startY + start.startH - newH; }
            if (type === 'tr') { localNewY = start.startY + start.startH - newH; }
            if (type === 'bl') { localNewX = start.startX + start.startW - newW; }
          }
        }

        const newCxLocal = localNewX + newW / 2, newCyLocal = localNewY + newH / 2;
        let newFxLocal = localNewX, newFyLocal = localNewY;
        if (type === 'br') { newFxLocal = localNewX; newFyLocal = localNewY; } else if (type === 'tl') { newFxLocal = localNewX + newW; newFyLocal = localNewY + newH; }
        else if (type === 'tr') { newFxLocal = localNewX; newFyLocal = localNewY + newH; } else if (type === 'bl') { newFxLocal = localNewX + newW; newFyLocal = localNewY; }
        else if (type === 'r') { newFxLocal = localNewX; newFyLocal = localNewY + newH / 2; } else if (type === 'l') { newFxLocal = localNewX + newW; newFyLocal = localNewY + newH / 2; }
        else if (type === 'b') { newFxLocal = localNewX + newW / 2; newFyLocal = localNewY; } else if (type === 't') { newFxLocal = localNewX + newW / 2; newFyLocal = localNewY + newH; }

        let dxLocal = newFxLocal - newCxLocal, dyLocal = newFyLocal - newCyLocal;
        let dxWorld = dxLocal, dyWorld = dyLocal;
        if (el.rotation) {
           const rad = (el.rotation * Math.PI) / 180;
           dxWorld = Math.cos(rad) * dxLocal - Math.sin(rad) * dyLocal;
           dyWorld = Math.sin(rad) * dxLocal + Math.cos(rad) * dyLocal;
        }

        el.width = newW; el.height = newH; el.x = start.fwx - dxWorld - newW / 2; el.y = start.fwy - dyWorld - newH / 2;
        if (el.type === "text") el.fontSize = Math.max(10, ['r', 'l'].includes(type) ? el.fontSize * (newW / (ctx.measureText(el.text).width || 1)) : el.height);
        return
      }

      if (!draggingRef.current || !el) return
      hasMovedRef.current = true; 

      let rawX = mouse.x - offsetRef.current.x, rawY = mouse.y - offsetRef.current.y;
      let snappedX = rawX, snappedY = rawY;
      
      guideX.current = null; guideY.current = null;
      let bestDistX = 6 / zoomRef.current, bestDistY = 6 / zoomRef.current;
      let snappedToObjX = false, snappedToObjY = false;

      elementsRef.current.forEach(other => {
        if (selectedRef.current.includes(other)) return
        const checkX = (targetGuide, myOffset) => { const dist = Math.abs(targetGuide - (rawX + myOffset)); if (dist < bestDistX) { bestDistX = dist; snappedX = targetGuide - myOffset; guideX.current = targetGuide; snappedToObjX = true; } }
        const checkY = (targetGuide, myOffset) => { const dist = Math.abs(targetGuide - (rawY + myOffset)); if (dist < bestDistY) { bestDistY = dist; snappedY = targetGuide - myOffset; guideY.current = targetGuide; snappedToObjY = true; } }

        const oL = other.x, oR = other.x + other.width, oCX = other.x + other.width / 2;
        const oT = other.y, oB = other.y + other.height, oCY = other.y + other.height / 2;
        const mW = el.width, mH = el.height, mCX = el.width / 2, mCY = el.height / 2;

        checkX(oL, 0); checkX(oL, mW); checkX(oR, 0); checkX(oR, mW); checkX(oCX, mCX);
        checkY(oT, 0); checkY(oT, mH); checkY(oB, 0); checkY(oB, mH); checkY(oCY, mCY);
      })

      if (snapGridRef.current) {
        if (!snappedToObjX) snappedX = Math.round(rawX / GRID) * GRID
        if (!snappedToObjY) snappedY = Math.round(rawY / GRID) * GRID
      }

      const dx = snappedX - el.x, dy = snappedY - el.y;
      selectedRef.current.forEach(item => { item.x += dx; item.y += dy; });
    }

    function mouseup() {
      if ((draggingRef.current && hasMovedRef.current) || resizingRef.current) pushHistory(JSON.parse(JSON.stringify(elementsRef.current)));
      draggingRef.current = false; resizingRef.current = null; panning.current = false; hasMovedRef.current = false;
      selectionBoxRef.current = null; resizeDataRef.current = null;
      canvas.style.cursor = "default"; guideX.current = null; guideY.current = null;
    }

    function wheel(e) { e.preventDefault(); if(editingText) return; zoomRef.current += -e.deltaY * 0.001; zoomRef.current = Math.max(0.1, Math.min(5, zoomRef.current)) }

    function keydown(e) {
      if (editingText) return;
      if (e.code === "Space") spaceHeld.current = true
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { if (e.shiftKey) redo(); else undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) { if (selectedRef.current.length > 0) { selectedRef.current.forEach(el => delete el.groupId); pushHistory(JSON.parse(JSON.stringify(elementsRef.current))); } } 
        else { if (selectedRef.current.length > 1) { const newGroupId = Date.now() + Math.random(); selectedRef.current.forEach(el => el.groupId = newGroupId); pushHistory(JSON.parse(JSON.stringify(elementsRef.current))); } }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedRef.current.length > 0) { selectedRef.current.forEach(el => { const i = elementsRef.current.indexOf(el); if (i !== -1) elementsRef.current.splice(i, 1) }); selectedRef.current = []; pushHistory(JSON.parse(JSON.stringify(elementsRef.current))); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault(); 
        if (selectedRef.current.length > 0) {
          const newSelection = []
          selectedRef.current.forEach(el => { const copy = { ...el, id: Date.now() + Math.random(), x: el.x + 20, y: el.y + 20 }; delete copy.groupId; elementsRef.current.push(copy); newSelection.push(copy) })
          selectedRef.current = newSelection; pushHistory(JSON.parse(JSON.stringify(elementsRef.current)));
        }
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (selectedRef.current.length > 0) {
          e.preventDefault(); const step = e.shiftKey ? 10 : 1;
          selectedRef.current.forEach(el => { if (e.key === "ArrowUp") el.y -= step; if (e.key === "ArrowDown") el.y += step; if (e.key === "ArrowLeft") el.x -= step; if (e.key === "ArrowRight") el.x += step; });
          pushHistory(JSON.parse(JSON.stringify(elementsRef.current)));
        }
      }
    }

    function keyup(e) { if (e.code === "Space") spaceHeld.current = false }

    canvas.addEventListener("mousedown", mousedown); canvas.addEventListener("mousemove", mousemove); canvas.addEventListener("mouseup", mouseup)
    canvas.addEventListener("dblclick", dblclick); canvas.addEventListener("wheel", wheel, { passive: false }); canvas.addEventListener("contextmenu", preventContextMenu)
    window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup)

    function drawGrid() {
      const size = GRID * zoomRef.current; ctx.lineWidth = 1;
      const minorColor = theme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)", majorColor = theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"
      for (let x = (panRef.current.x % size); x < canvas.width; x += size) { ctx.strokeStyle = minorColor; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke() }
      for (let y = (panRef.current.y % size); y < canvas.height; y += size) { ctx.strokeStyle = minorColor; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke() }
      const major = size * 5; ctx.lineWidth = 1.5;
      for (let x = (panRef.current.x % major); x < canvas.width; x += major) { ctx.strokeStyle = majorColor; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke() }
      for (let y = (panRef.current.y % major); y < canvas.height; y += major) { ctx.strokeStyle = majorColor; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke() }
    }

    function drawGuides() {
      ctx.strokeStyle = "#ff453a"; ctx.lineWidth = 1;
      if (guideX.current !== null) { ctx.beginPath(); ctx.moveTo(guideX.current * zoomRef.current + panRef.current.x, 0); ctx.lineTo(guideX.current * zoomRef.current + panRef.current.x, canvas.height); ctx.stroke() }
      if (guideY.current !== null) { ctx.beginPath(); ctx.moveTo(0, guideY.current * zoomRef.current + panRef.current.y); ctx.lineTo(canvas.width, guideY.current * zoomRef.current + panRef.current.y); ctx.stroke() }
    }

    function drawHandles(el) {
      const h = handles(el); const apparentSize = HANDLE / zoomRef.current;
      ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 1.5 / zoomRef.current;
      ctx.beginPath();
      const startX = el.x + el.width / 2; const startY = el.type === 'line' ? el.y + el.height / 2 : el.y;
      ctx.moveTo(startX, startY); ctx.lineTo(h.rot[0], h.rot[1]); ctx.stroke();

      Object.entries(h).forEach(([k, [x, y]]) => { 
        ctx.beginPath(); 
        if (k === 'rot') ctx.arc(x, y, apparentSize / 1.5, 0, Math.PI * 2); else ctx.rect(x - apparentSize / 2, y - apparentSize / 2, apparentSize, apparentSize); 
        ctx.fill(); ctx.stroke();
      })
    }

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height); drawGrid();
      ctx.save(); ctx.translate(panRef.current.x, panRef.current.y); ctx.scale(zoomRef.current, zoomRef.current);

      elementsRef.current.forEach(el => {
        ctx.save();
        if (el.rotation) {
          const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
          ctx.translate(cx, cy); ctx.rotate((el.rotation * Math.PI) / 180); ctx.translate(-cx, -cy);
        }

        if (el.type === "rect" || el.type === "line") { ctx.fillStyle = el.fill; ctx.fillRect(el.x, el.y, el.width, el.height) }
        if (el.type === "circle") { ctx.fillStyle = el.fill; ctx.beginPath(); ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, 2 * Math.PI); ctx.fill(); }

        if (el.type === "image") {
          if (el.src) {
            if (!window.imageCache[el.id]) {
              const img = new Image(); img.src = el.src; window.imageCache[el.id] = img;
            }
            if (window.imageCache[el.id].complete) ctx.drawImage(window.imageCache[el.id], el.x, el.y, el.width, el.height);
          } else {
            ctx.fillStyle = el.fill || "#e2e8f0"; ctx.fillRect(el.x, el.y, el.width, el.height)
            ctx.strokeStyle = el.stroke || "#94a3b8"; ctx.lineWidth = 2 / zoomRef.current; ctx.setLineDash([8 / zoomRef.current, 8 / zoomRef.current]); ctx.strokeRect(el.x, el.y, el.width, el.height); ctx.setLineDash([]) 
            ctx.fillStyle = el.stroke || "#94a3b8"; ctx.font = `600 ${Math.max(12, Math.min(el.width, el.height) * 0.2)}px Inter, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"
            ctx.fillText("🖼️ Image", el.x + el.width / 2, el.y + el.height / 2); ctx.textAlign = "start"; ctx.textBaseline = "top"
          }
        }

        if (el.type === "text" && !el.isEditing) { ctx.fillStyle = el.color; ctx.font = `${el.fontSize}px Inter, sans-serif`; ctx.textBaseline = "top"; ctx.fillText(el.text, el.x, el.y) }
        if (selectedRef.current.includes(el)) { ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 1.5 / zoomRef.current; ctx.strokeRect(el.x, el.y, el.width, el.height); drawHandles(el); }
        ctx.restore();
      })

      if (selectionBoxRef.current) {
        ctx.fillStyle = "rgba(14, 165, 233, 0.1)"; ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 1 / zoomRef.current;
        const box = selectionBoxRef.current; ctx.fillRect(box.x, box.y, box.w, box.h); ctx.strokeRect(box.x, box.y, box.w, box.h);
      }

      ctx.restore(); drawGuides(); animationFrameId = requestAnimationFrame(render);
    }
    render()

    return () => {
      cancelAnimationFrame(animationFrameId); window.removeEventListener("resize", resizeCanvas); window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup);
      canvas.removeEventListener("mousedown", mousedown); canvas.removeEventListener("mousemove", mousemove); canvas.removeEventListener("mouseup", mouseup); canvas.removeEventListener("dblclick", dblclick); canvas.removeEventListener("wheel", wheel); canvas.removeEventListener("contextmenu", preventContextMenu)
    }
  }, [theme, editingText, undo, redo]) 

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1, width: "100%", height: "100vh" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", background: theme === "dark" ? "#0f172a" : "#f8fafc", outline: "none" }} tabIndex={0} />
      <div style={{ position: "absolute", bottom: "20px", left: "20px", background: theme === "dark" ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.85)", padding: "10px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "500", color: theme === "dark" ? "#cbd5e1" : "#475569", pointerEvents: "none", border: "1px solid", borderColor: theme === "dark" ? "#334155" : "#e2e8f0", backdropFilter: "blur(4px)", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", zIndex: 100 }}>
        💡 <strong>Pan:</strong> Space + Drag <span style={{opacity: 0.5, margin: "0 6px"}}>|</span> <strong>Shift:</strong> Snap grid while rotating
      </div>
      {editingText && (
        <input
          autoFocus value={editingText.text} onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
          onBlur={() => { editingText.el.text = editingText.text; editingText.el.isEditing = false; setEditingText(null); pushHistory(JSON.parse(JSON.stringify(window.canvasElements.current))); }}
          onKeyDown={(e) => { if (e.key === "Enter") { editingText.el.text = editingText.text; editingText.el.isEditing = false; setEditingText(null); pushHistory(JSON.parse(JSON.stringify(window.canvasElements.current))); } }}
          style={{ position: "absolute", left: editingText.x, top: editingText.y, fontSize: `${editingText.fontSize}px`, color: editingText.color, fontFamily: "Inter, sans-serif", background: theme === "dark" ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.9)", border: "1px solid #0ea5e9", borderRadius: "4px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", outline: "none", padding: "0 4px", margin: "-1px -5px", lineHeight: 1, zIndex: 10 }}
        />
      )}
    </div>
  )
}