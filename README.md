# 🎨 Pixora

**Pixora** is a high-performance, browser-based vector design engine. Built with **React** and **HTML5 Canvas**, it offers a lightweight but powerful alternative to heavy design software, featuring a custom math engine for object manipulation.

---

## 🚀 Key Features

* **Custom Physics Engine:** Built from scratch to handle object collisions, rotation math, and scaling.
* **Proportional Scaling:** Hold `Shift` to lock aspect ratios—perfect for images and circles.
* **Smart Visual Layering:** One-click depth control. Objects intelligently jump over or under overlapping groups.
* **Object Stitching (Grouping):** Link multiple elements into a single entity using `Ctrl+G`.
* **Dynamic Styling:** Real-time color control, line thickness sliders, and text editing.
* **High-Res Production:** 2x scaled PNG export with intelligent canvas cropping.
* **Project Persistence:** LocalStorage autosave + JSON project export/import.

## 🛠️ Tech Stack

* **Frontend:** React 18, Vite
* **Engine:** HTML5 Canvas API
* **Styling:** Modern CSS3 / Dark Mode support

## 💻 Installation

1. **Clone & Install**
   ```bash
   git clone [https://github.com/hk9981/pixora.git](https://github.com/hk9918/pixora.git)
   cd pixora
   npm install
   npm run dev
   npm run build (for production)