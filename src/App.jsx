import { useState, useEffect } from "react";
import CanvasEditor from "./components/CanvasEditor";
import Toolbar from "./components/Toolbar";

function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [color, setColor] = useState("#3B82F6");
  const [snapToGrid, setSnapToGrid] = useState(true);

  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("design_canvas_data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return [saved];
      }
    } catch (e) {
      console.error("Save data corrupted. Resetting.");
      localStorage.removeItem("design_canvas_data");
    }
    return [JSON.stringify([])];
  });
  
  const [historyIndex, setHistoryIndex] = useState(0);
  const [elements, setElements] = useState(() => JSON.parse(history[0]));

  useEffect(() => {
    if (window.canvasElements) window.canvasElements.current = elements;
  }, []);

  function rebindSelection(newElements) {
    if (window.selectedElement?.current) {
      const selectedIds = window.selectedElement.current.map(el => el.id);
      window.selectedElement.current = newElements.filter(el => selectedIds.includes(el.id));
    }
  }

  function pushHistory(newElementsArray) {
    const snapshot = JSON.stringify(newElementsArray);
    localStorage.setItem("design_canvas_data", snapshot);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snapshot);
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    setElements(newElementsArray);
    if (window.canvasElements) window.canvasElements.current = newElementsArray;
    
    rebindSelection(newElementsArray); 
  }

  function undo() {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const snapshot = history[prevIndex];
      const parsed = JSON.parse(snapshot);
      localStorage.setItem("design_canvas_data", snapshot);
      setHistoryIndex(prevIndex);
      setElements(parsed);
      if (window.canvasElements) window.canvasElements.current = parsed;
      rebindSelection(parsed);
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const snapshot = history[nextIndex];
      const parsed = JSON.parse(snapshot);
      localStorage.setItem("design_canvas_data", snapshot);
      setHistoryIndex(nextIndex);
      setElements(parsed);
      if (window.canvasElements) window.canvasElements.current = parsed;
      rebindSelection(parsed);
    }
  }

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.body.className = theme;
    document.body.style.margin = "0";
    document.body.style.backgroundColor = theme === "dark" ? "#0b1220" : "#f1f5f9";
  }, [theme]);

  function toggleTheme() { setTheme(prev => prev === "light" ? "dark" : "light"); }
  function getLatestElements() { return window.canvasElements?.current || elements; }

  function getOffset() {
    return (getLatestElements().length % 12) * 20; 
  }

  function addRectangle() {
    const off = getOffset();
    const newRect = { id: Date.now(), type: "rect", x: window.innerWidth / 2 - 100 + off, y: window.innerHeight / 2 - 60 + off, width: 200, height: 120, fill: color, rotation: 0 };
    pushHistory([...getLatestElements(), newRect]);
  }

  function addLine() {
    const off = getOffset();
    const newLine = { id: Date.now(), type: "line", x: window.innerWidth / 2 - 100 + off, y: window.innerHeight / 2 - 2 + off, width: 200, height: 4, fill: color, rotation: 0 };
    pushHistory([...getLatestElements(), newLine]);
  }

  function addCircle() {
    const off = getOffset();
    const newCircle = { id: Date.now(), type: "circle", x: window.innerWidth / 2 - 60 + off, y: window.innerHeight / 2 - 60 + off, width: 120, height: 120, fill: color, rotation: 0 };
    pushHistory([...getLatestElements(), newCircle]);
  }

  function addText() {
    const off = getOffset();
    const newText = { id: Date.now(), type: "text", x: window.innerWidth / 2 - 80 + off, y: window.innerHeight / 2 - 20 + off, text: "Double click to edit", fontSize: 28, color: theme === "dark" ? "#ffffff" : "#0f172a", rotation: 0 };
    pushHistory([...getLatestElements(), newText]);
  }

  function addImagePlaceholder() {
    const off = getOffset();
    const newImage = { id: Date.now(), type: "image", src: null, x: window.innerWidth / 2 - 100 + off, y: window.innerHeight / 2 - 100 + off, width: 200, height: 200, fill: theme === "dark" ? "#1e293b" : "#e2e8f0", stroke: theme === "dark" ? "#475569" : "#94a3b8", rotation: 0 };
    pushHistory([...getLatestElements(), newImage]);
  }

  function addUploadedImage(src, width, height) {
    const off = getOffset();
    const maxW = 400;
    const scale = width > maxW ? maxW / width : 1;
    const finalW = width * scale;
    const finalH = height * scale;
    const newImage = { id: Date.now(), type: "image", src: src, x: window.innerWidth / 2 - (finalW/2) + off, y: window.innerHeight / 2 - (finalH/2) + off, width: finalW, height: finalH, rotation: 0 };
    pushHistory([...getLatestElements(), newImage]);
  }

  function saveProject() {
    const currentElements = getLatestElements();
    const blob = new Blob([JSON.stringify(currentElements)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pixel-forge-project.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function loadProject(jsonData) {
    try {
      const parsed = JSON.parse(jsonData);
      if (Array.isArray(parsed)) pushHistory(parsed);
      else alert("Invalid project file format!");
    } catch (err) {
      alert("Failed to load project file!");
    }
  }

  function exportCanvas() {
    const currentElements = (window.canvasElements?.current || elements).filter(el => {
      if (el.type === 'text' && (!el.text || el.text.trim() === "")) return false;
      return true;
    });

    if (currentElements.length === 0) return alert("Canvas is empty!");

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    currentElements.forEach(el => {
      let pts = [];
      if (el.rotation) {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        const rad = (el.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotatePoint = (px, py) => ({
          x: cos * (px - cx) - sin * (py - cy) + cx,
          y: sin * (px - cx) + cos * (py - cy) + cy
        });
        
        pts.push(rotatePoint(el.x, el.y));
        pts.push(rotatePoint(el.x + el.width, el.y));
        pts.push(rotatePoint(el.x, el.y + el.height));
        pts.push(rotatePoint(el.x + el.width, el.y + el.height));
      } else {
        pts.push({ x: el.x, y: el.y });
        pts.push({ x: el.x + el.width, y: el.y + el.height });
      }

      pts.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });

    const padding = 40;
    minX -= padding; minY -= padding; maxX += padding; maxY += padding;

    const tempCanvas = document.createElement("canvas");
    const exportScale = 2; 
    
    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    tempCanvas.width = cropWidth * exportScale; 
    tempCanvas.height = cropHeight * exportScale;
    const ctx = tempCanvas.getContext("2d");

    ctx.scale(exportScale, exportScale); 
    ctx.fillStyle = theme === "dark" ? "#0f172a" : "#ffffff";
    ctx.fillRect(0, 0, cropWidth, cropHeight); 

    const cache = window.imageCache || {};

    currentElements.forEach(el => {
      ctx.save();
      const drawX = el.x - minX, drawY = el.y - minY;
      
      if (el.rotation) {
        const cx = drawX + el.width / 2;
        const cy = drawY + el.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((el.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }
      
      if (el.type === "rect" || el.type === "line") { ctx.fillStyle = el.fill; ctx.fillRect(drawX, drawY, el.width, el.height); }
      if (el.type === "circle") {
        ctx.fillStyle = el.fill; ctx.beginPath();
        ctx.ellipse(drawX + el.width / 2, drawY + el.height / 2, el.width / 2, el.height / 2, 0, 0, 2 * Math.PI);
        ctx.fill();
      }
      if (el.type === "image") {
        if (el.src && cache[el.id] && cache[el.id].complete) {
          ctx.drawImage(cache[el.id], drawX, drawY, el.width, el.height);
        } else {
          ctx.fillStyle = el.fill || "#e2e8f0"; ctx.fillRect(drawX, drawY, el.width, el.height);
          ctx.strokeStyle = el.stroke || "#94a3b8"; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.strokeRect(drawX, drawY, el.width, el.height); ctx.setLineDash([]);
          ctx.fillStyle = el.stroke || "#94a3b8"; const iconSize = Math.max(12, Math.min(el.width, el.height) * 0.2);
          ctx.font = `600 ${iconSize}px Inter, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("🖼️ Image", drawX + el.width / 2, drawY + el.height / 2);
          ctx.textAlign = "start"; ctx.textBaseline = "top";
        }
      }
      if (el.type === "text" && !el.isEditing) {
        ctx.fillStyle = el.color; ctx.font = `${el.fontSize}px Inter, sans-serif`; ctx.textBaseline = "top"; ctx.fillText(el.text, drawX, drawY);
      }
      ctx.restore();
    });

    const link = document.createElement("a");
    link.download = "design-export.png"; link.href = tempCanvas.toDataURL("image/png"); link.click();
  }

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", fontFamily: "Inter, system-ui, sans-serif" }}>
      <Toolbar
        addRectangle={addRectangle} addLine={addLine} addCircle={addCircle} addText={addText} addImagePlaceholder={addImagePlaceholder} addUploadedImage={addUploadedImage}
        exportCanvas={exportCanvas} saveProject={saveProject} loadProject={loadProject} toggleTheme={toggleTheme}
        setColor={setColor} color={color} theme={theme}
        snapToGrid={snapToGrid} setSnapToGrid={setSnapToGrid}
        undo={undo} redo={redo} canUndo={historyIndex > 0} canRedo={historyIndex < history.length - 1} pushHistory={pushHistory}
      />
      <CanvasEditor elements={elements} theme={theme} snapToGrid={snapToGrid} undo={undo} redo={redo} pushHistory={pushHistory} />
    </div>
  );
}

export default App;