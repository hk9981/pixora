import { useEffect, useState, useRef } from "react"

export default function Toolbar({
  addRectangle, addLine, addCircle, addText, addImagePlaceholder, addUploadedImage, 
  exportCanvas, saveProject, loadProject, toggleTheme,
  setColor, color, theme, snapToGrid, setSnapToGrid,
  undo, redo, canUndo, canRedo, pushHistory
}) {
  const [selectedElements, setSelectedElements] = useState([])
  const fileInputRef = useRef(null)
  const projectInputRef = useRef(null)

  useEffect(() => {
    const checkSelection = setInterval(() => {
      const currentSelection = window.selectedElement?.current || []
      setSelectedElements([...currentSelection])
    }, 50)
    return () => clearInterval(checkSelection)
  }, [])

  const isDark = theme === "dark"
  const panelBg = isDark ? "#1e293b" : "#ffffff"
  const textColor = isDark ? "#f8fafc" : "#0f172a"
  const borderColor = isDark ? "#334155" : "#e2e8f0"
  const btnBg = isDark ? "#334155" : "#f1f5f9"

  const sectionStyle = { padding: "16px 20px", borderBottom: `1px solid ${borderColor}` }
  const labelStyle = { fontSize: "11px", fontWeight: "bold", letterSpacing: "0.5px", textTransform: "uppercase", color: isDark ? "#94a3b8" : "#64748b", marginBottom: "10px", display: "block" }
  const btnStyle = { width: "100%", padding: "10px 12px", marginBottom: "8px", borderRadius: "6px", border: "none", background: btnBg, color: textColor, textAlign: "left", cursor: "pointer", fontSize: "13px", fontWeight: "500", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }
  const inputGridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }
  const propInputStyle = { width: "100%", padding: "8px", borderRadius: "4px", border: `1px solid ${borderColor}`, background: isDark ? "#0f172a" : "#f8fafc", color: textColor, fontSize: "12px", boxSizing: "border-box" }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target.result;
      const img = new Image();
      img.onload = () => addUploadedImage(src, img.width, img.height);
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = ""; 
  }

  function handleProjectUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => loadProject(event.target.result);
    reader.readAsText(file);
    e.target.value = ""; 
  }

  function commitAction(actionFn) {
    actionFn();
    const els = window.canvasElements?.current || [];
    pushHistory(JSON.parse(JSON.stringify(els)));
  }

  function bringForward() {
    commitAction(() => {
      const selected = window.selectedElement?.current || []
      const els = window.canvasElements?.current
      if (selected.length === 0 || !els) return
      const sortedSelected = [...selected].sort((a, b) => els.indexOf(a) - els.indexOf(b));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selected.forEach(el => {
        minX = Math.min(minX, el.x); minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width); maxY = Math.max(maxY, el.y + el.height);
      });
      const overlaps = (other) => !(other.x > maxX || other.x + other.width < minX || other.y > maxY || other.y + other.height < minY);
      const highestIdx = els.indexOf(sortedSelected[sortedSelected.length - 1]);
      if (highestIdx === -1 || highestIdx >= els.length - 1) return;
      let targetIdx = highestIdx + 1;
      for (let j = highestIdx + 1; j < els.length; j++) {
        if (!selected.includes(els[j]) && overlaps(els[j])) { targetIdx = j; break; }
      }
      const targetEl = els[targetIdx];
      if (targetEl && targetEl.groupId) {
        for (let k = 0; k < els.length; k++) {
          if (els[k].groupId === targetEl.groupId) targetIdx = Math.max(targetIdx, k);
        }
      }
      const remaining = els.filter(el => !selected.includes(el));
      let newInsertIdx = remaining.indexOf(els[targetIdx]);
      if (newInsertIdx === -1) newInsertIdx = remaining.length - 1;
      remaining.splice(newInsertIdx + 1, 0, ...sortedSelected);
      els.length = 0; els.push(...remaining);
    })
  }

  function sendBackward() {
    commitAction(() => {
      const selected = window.selectedElement?.current || []
      const els = window.canvasElements?.current
      if (selected.length === 0 || !els) return
      const sortedSelected = [...selected].sort((a, b) => els.indexOf(a) - els.indexOf(b));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selected.forEach(el => {
        minX = Math.min(minX, el.x); minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width); maxY = Math.max(maxY, el.y + el.height);
      });
      const overlaps = (other) => !(other.x > maxX || other.x + other.width < minX || other.y > maxY || other.y + other.height < minY);
      const lowestIdx = els.indexOf(sortedSelected[0]);
      if (lowestIdx <= 0) return;
      let targetIdx = lowestIdx - 1;
      for (let j = lowestIdx - 1; j >= 0; j--) {
        if (!selected.includes(els[j]) && overlaps(els[j])) { targetIdx = j; break; }
      }
      const targetEl = els[targetIdx];
      if (targetEl && targetEl.groupId) {
        for (let k = 0; k < els.length; k++) {
          if (els[k].groupId === targetEl.groupId) targetIdx = Math.min(targetIdx, k);
        }
      }
      const remaining = els.filter(el => !selected.includes(el));
      let newInsertIdx = remaining.indexOf(els[targetIdx]);
      if (newInsertIdx === -1) newInsertIdx = 0;
      remaining.splice(newInsertIdx, 0, ...sortedSelected);
      els.length = 0; els.push(...remaining);
    })
  }

  function bringToFront() {
    commitAction(() => {
      const selected = window.selectedElement?.current || [];
      const els = window.canvasElements?.current;
      if (selected.length === 0 || !els) return;
      const sortedSelected = [...selected].sort((a, b) => els.indexOf(a) - els.indexOf(b));
      sortedSelected.forEach(el => {
        const idx = els.indexOf(el);
        if (idx > -1) els.splice(idx, 1);
      });
      els.push(...sortedSelected);
    })
  }

  function sendToBack() {
    commitAction(() => {
      const selected = window.selectedElement?.current || [];
      const els = window.canvasElements?.current;
      if (selected.length === 0 || !els) return;
      const sortedSelected = [...selected].sort((a, b) => els.indexOf(a) - els.indexOf(b));
      sortedSelected.forEach(el => {
        const idx = els.indexOf(el);
        if (idx > -1) els.splice(idx, 1);
      });
      els.unshift(...sortedSelected);
    })
  }

  function deleteSelected() {
    commitAction(() => {
      const selected = window.selectedElement?.current || []
      const els = window.canvasElements?.current
      if (!els) return
      selected.forEach(el => { const i = els.indexOf(el); if (i !== -1) els.splice(i, 1) })
      window.selectedElement.current = []
    })
  }

  function duplicateSelected() {
    commitAction(() => {
      const selected = window.selectedElement?.current || []
      const els = window.canvasElements?.current
      if (!els || selected.length === 0) return
      const newSelection = []
      selected.forEach(el => {
        const copy = { ...el, id: Date.now() + Math.random(), x: el.x + 20, y: el.y + 20 }
        delete copy.groupId; 
        els.push(copy); newSelection.push(copy)
      })
      window.selectedElement.current = newSelection
    })
  }

  function groupSelected() {
    commitAction(() => {
      const selected = window.selectedElement?.current || []
      if (selected.length < 2) return
      const newGroupId = Date.now() + Math.random() 
      selected.forEach(el => el.groupId = newGroupId)
    })
  }

  function ungroupSelected() {
    commitAction(() => {
      const selected = window.selectedElement?.current || []
      selected.forEach(el => delete el.groupId)
    })
  }

  function handlePropertyChange(prop, value) {
    const els = window.selectedElement?.current || []
    const numValue = Number(value)
    if (isNaN(numValue)) return
    els.forEach(el => {
      if (prop === "w") {
        el.width = Math.max(el.type === 'line' ? 2 : 10, numValue);
        if (el.type === 'circle') el.height = el.width; 
      }
      if (prop === "h") {
        el.height = Math.max(el.type === 'line' ? 2 : 10, numValue);
        if (el.type === 'circle') el.width = el.height;
      }
      if (prop === "x") el.x = numValue
      if (prop === "y") el.y = numValue
      if (prop === "rotation") el.rotation = numValue 
      if (el.type === "text" && prop === "h") el.fontSize = Math.max(10, numValue)
    })
    const allEls = window.canvasElements?.current || [];
    pushHistory(JSON.parse(JSON.stringify(allEls)));
  }

  const selectedEl = selectedElements[0]
  const activeColor = selectedEl ? (selectedEl.type === "text" ? selectedEl.color : selectedEl.fill) : color;
  const hasGroupedItems = selectedElements.some(el => el.groupId !== undefined);

  return (
    <div style={{ width: "260px", height: "100vh", background: panelBg, borderRight: `1px solid ${borderColor}`, display: "flex", flexDirection: "column", overflowY: "auto", boxSizing: "border-box" }}>
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="11" height="11" rx="3" fill="#3B82F6" />
            <rect x="9" y="9" width="11" height="11" rx="3" fill="#10B981" fillOpacity="0.9" />
            <circle cx="16" cy="8" r="2.5" fill="#F43F5E" />
          </svg>
          <h2 style={{ fontSize: "16px", fontWeight: "800", margin: 0, color: textColor, letterSpacing: "-0.5px" }}>
            Pixora
          </h2>
        </div>
          <button onClick={toggleTheme} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "16px" }}>{isDark ? "☀" : "🌙"}</button>
        </div>
        
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button onClick={undo} disabled={!canUndo} style={{...btnStyle, flex: 1, marginBottom: 0, opacity: canUndo ? 1 : 0.5}}>↩ Undo</button>
          <button onClick={redo} disabled={!canRedo} style={{...btnStyle, flex: 1, marginBottom: 0, opacity: canRedo ? 1 : 0.5}}>↪ Redo</button>
        </div>
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>File & Export</span>
        <button onClick={exportCanvas} style={{...btnStyle, background: "#3B82F6", color: "#fff"}}>Export High-Res PNG <span>⬇</span></button>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button onClick={saveProject} style={{...btnStyle, flex: 1, marginBottom: 0, border: `1px solid ${borderColor}`}}>Save .json</button>
          <input type="file" accept=".json" ref={projectInputRef} onChange={handleProjectUpload} style={{ display: "none" }} />
          <button onClick={() => projectInputRef.current?.click()} style={{...btnStyle, flex: 1, marginBottom: 0, border: `1px solid ${borderColor}`}}>Load .json</button>
        </div>
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>Add Elements</span>
        <button onClick={addRectangle} style={btnStyle}>Rectangle <span>▢</span></button>
        <button onClick={addLine} style={btnStyle}>Line <span>―</span></button>
        <button onClick={addCircle} style={btnStyle}>Circle <span>◯</span></button>
        <button onClick={addText} style={btnStyle}>Text <span>T</span></button>
        <button onClick={addImagePlaceholder} style={btnStyle}>Box Placeholder <span>🖼️</span></button>
        <input type="file" accept="image/png, image/jpeg, image/webp" ref={fileInputRef} onChange={handleImageUpload} style={{ display: "none" }} />
        <button onClick={() => fileInputRef.current?.click()} style={{...btnStyle, border: `1px dashed ${isDark ? "#475569" : "#cbd5e1"}`}}>Upload Image <span>📁</span></button>
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>Settings</span>
        <button onClick={() => setSnapToGrid(!snapToGrid)} style={{...btnStyle, border: snapToGrid ? "1px solid #0ea5e9" : "none"}}>
          Snap to Grid <span style={{color: snapToGrid ? "#0ea5e9" : "inherit"}}>{snapToGrid ? "ON" : "OFF"}</span>
        </button>
      </div>

      {selectedElements.length > 0 ? (
        <>
          <div style={sectionStyle}>
            <span style={labelStyle}>Properties Panel</span>
            {selectedElements.length === 1 ? (
              <div style={inputGridStyle}>
                <div><div style={{fontSize:"10px", color: isDark?"#94a3b8":"#64748b", marginBottom:"4px"}}>X</div><input type="number" value={Math.round(selectedEl.x)} onBlur={(e) => handlePropertyChange("x", e.target.value)} onChange={(e)=> { selectedEl.x = Number(e.target.value) }} style={propInputStyle}/></div>
                <div><div style={{fontSize:"10px", color: isDark?"#94a3b8":"#64748b", marginBottom:"4px"}}>Y</div><input type="number" value={Math.round(selectedEl.y)} onBlur={(e) => handlePropertyChange("y", e.target.value)} onChange={(e)=> { selectedEl.y = Number(e.target.value) }} style={propInputStyle}/></div>
                <div><div style={{fontSize:"10px", color: isDark?"#94a3b8":"#64748b", marginBottom:"4px"}}>W</div><input type="number" value={Math.round(selectedEl.width || 0)} onBlur={(e) => handlePropertyChange("w", e.target.value)} onChange={(e)=> { selectedEl.width = Number(e.target.value) }} style={propInputStyle}/></div>
                <div><div style={{fontSize:"10px", color: isDark?"#94a3b8":"#64748b", marginBottom:"4px"}}>H</div><input type="number" value={Math.round(selectedEl.height || 0)} onBlur={(e) => handlePropertyChange("h", e.target.value)} onChange={(e)=> { selectedEl.height = Number(e.target.value) }} style={propInputStyle}/></div>
              </div>
            ) : (
              <div style={{fontSize: "12px", color: isDark?"#94a3b8":"#64748b", marginBottom: "16px"}}>Multiple items selected</div>
            )}

            {selectedElements.length === 1 && selectedEl.type === "line" && (
              <div style={{ marginTop: "16px" }}>
                <div style={{fontSize:"10px", color: isDark?"#94a3b8":"#64748b", marginBottom:"4px", display: "flex", justifyContent: "space-between"}}>
                  <span>THICKNESS</span> <span>{Math.round(selectedEl.height)}px</span>
                </div>
                <input type="range" min="1" max="50" value={Math.round(selectedEl.height)} onMouseUp={() => pushHistory(JSON.parse(JSON.stringify(window.canvasElements.current)))} onTouchEnd={() => pushHistory(JSON.parse(JSON.stringify(window.canvasElements.current)))} onChange={(e) => {
                    const val = Number(e.target.value);
                    selectedElements.forEach(el => { if (el.type === 'line') el.height = val; });
                  }} style={{ width: "100%", cursor: "pointer" }} />
              </div>
            )}

            <div style={{ marginTop: "16px" }}>
              <div style={{fontSize:"10px", color: isDark?"#94a3b8":"#64748b", marginBottom:"4px", display: "flex", justifyContent: "space-between"}}>
                <span>ROTATION (°)</span> <span>{Math.round(selectedEl.rotation || 0)}°</span>
              </div>
              <input type="range" min="0" max="360" value={Math.round(selectedEl.rotation || 0)} onMouseUp={() => pushHistory(JSON.parse(JSON.stringify(window.canvasElements.current)))} onTouchEnd={() => pushHistory(JSON.parse(JSON.stringify(window.canvasElements.current)))} onChange={(e) => {
                  const val = Number(e.target.value);
                  selectedElements.forEach(el => el.rotation = val);
                }} style={{ width: "100%", cursor: "pointer" }} />
            </div>

            <div style={{ marginTop: "16px", display: (selectedElements.length === 1 && selectedEl.type === "image" && selectedEl.src) ? "none" : "block" }}>
              <div style={{fontSize:"10px", color: isDark?"#94a3b8":"#64748b", marginBottom:"4px"}}>COLOR</div>
              <input type="color" value={activeColor || "#000000"} onBlur={() => pushHistory(JSON.parse(JSON.stringify(window.canvasElements.current)))} onChange={(e) => {
                  const newColor = e.target.value; setColor(newColor); 
                  selectedElements.forEach(el => { 
                    if (el.type === "rect" || el.type === "line" || el.type === "circle" || (el.type === "image" && !el.src)) el.fill = newColor; 
                    if (el.type === "text") el.color = newColor 
                  })
                }} style={{ width: "100%", height: "36px", border: "none", background: "transparent", cursor: "pointer", padding: 0 }} />
            </div>
          </div>

          <div style={sectionStyle}>
            <span style={labelStyle}>Arrange & Actions</span>
            
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <button onClick={groupSelected} disabled={selectedElements.length < 2} style={{...btnStyle, flex: 1, marginBottom: 0, opacity: selectedElements.length > 1 ? 1 : 0.5}}>Group</button>
              <button onClick={ungroupSelected} disabled={!hasGroupedItems} style={{...btnStyle, flex: 1, marginBottom: 0, opacity: hasGroupedItems ? 1 : 0.5}}>Ungroup</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
              <button onClick={bringToFront} style={{...btnStyle, marginBottom: 0, padding: "8px"}} title="Jump to top layer">To Front <span>⇈</span></button>
              <button onClick={bringForward} style={{...btnStyle, marginBottom: 0, padding: "8px"}} title="Move up one visual layer">Forward <span>↑</span></button>
              <button onClick={sendToBack} style={{...btnStyle, marginBottom: 0, padding: "8px"}} title="Jump to bottom layer">To Back <span>⇊</span></button>
              <button onClick={sendBackward} style={{...btnStyle, marginBottom: 0, padding: "8px"}} title="Move down one visual layer">Backward <span>↓</span></button>
            </div>

            <button onClick={duplicateSelected} style={btnStyle}>Duplicate <span>Ctrl+D</span></button>
            <button onClick={deleteSelected} style={{...btnStyle, color: "#ef4444"}}>Delete <span>Del</span></button>
          </div>
        </>
      ) : (
        <div style={{ padding: "40px 20px", textAlign: "center", color: isDark ? "#64748b" : "#94a3b8", fontSize: "13px" }}>Select an element to view properties.</div>
      )}
    </div>
  )
}