import type { ElectricalDiagram } from "./contract";

// Inline presentation styles so an exported SVG does not depend on the app CSS/theme.
const presentationProperties = ["color", "fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "opacity", "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline", "paint-order"];

export function serializeDiagramSvg(svg: SVGSVGElement, canvas: ElectricalDiagram["canvas"]) {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const originalNodes = [svg, ...svg.querySelectorAll("*")];
  const copiedNodes = [copy, ...copy.querySelectorAll("*")];
  originalNodes.forEach((node, index) => {
    const style = window.getComputedStyle(node);
    copiedNodes[index].setAttribute("style", presentationProperties.map(property => `${property}:${style.getPropertyValue(property)}`).join(";"));
  });
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(canvas.width));
  copy.setAttribute("height", String(canvas.height));
  return new XMLSerializer().serializeToString(copy);
}

export function diagramPngSize(canvas: ElectricalDiagram["canvas"]) {
  // Crisp exports for normal diagrams, bounded memory for very large canvases.
  const scale = Math.min(2, 4096 / Math.max(canvas.width, canvas.height));
  return { width: Math.max(1, Math.round(canvas.width * scale)), height: Math.max(1, Math.round(canvas.height * scale)) };
}

export async function diagramPngBlob(svg: string, size: { width: number; height: number }): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Không dựng được ảnh PNG từ sơ đồ.")); image.src = url; });
    const canvas = document.createElement("canvas"); canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Trình duyệt không hỗ trợ xuất PNG.");
    context.drawImage(image, 0, 0, size.width, size.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Không xuất được PNG.")), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

export function downloadDiagramBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
