import { geometrySignature } from "./diagram-quality";
import type { ElectricalDiagram } from "./contract";
import { validateDiagramInput, type DiagramValidation } from "./validate-diagram";

export function parseManualDiagramJson(text: string, original: ElectricalDiagram): DiagramValidation {
  let input: unknown;
  try { input = JSON.parse(text); }
  catch { return { diagram: null, errors: ["JSON chưa hợp lệ. Kiểm tra dấu phẩy, dấu ngoặc và dấu nháy."] }; }
  const parsed = validateDiagramInput(input);
  if (!parsed.diagram) return parsed;
  for (const field of ["id", "vehicleId", "vehicleTitle", "circuitTitle"] as const) {
    if (parsed.diagram[field] !== original[field]) return { diagram: null, errors: [`Giữ nguyên ${field} để lưu đúng circuit trong project.`] };
  }
  for (const field of ['sourceCrop','sourceTransform'] as const) if (JSON.stringify(parsed.diagram[field]) !== JSON.stringify(original[field])) return {diagram:null,errors:['Giữ nguyên crop/xoay của ảnh nguồn khi sửa JSON. Nạp lại ảnh và JSON để đổi hệ tọa độ.']};
  if (parsed.diagram.reviewMetadata?.sourceSha256 !== original.reviewMetadata?.sourceSha256) return {diagram:null,errors:['Giữ nguyên SHA-256 của ảnh nguồn khi sửa JSON.']};
  if (original.drawing && parsed.diagram.drawing && geometrySignature(original) !== geometrySignature(parsed.diagram) && JSON.stringify(original.drawing) === JSON.stringify(parsed.diagram.drawing)) return { diagram: null, errors: ["Bạn đã đổi linh kiện/đường dây/chữ nhưng drawing vẫn là hình cũ. Cập nhật drawing cùng lúc hoặc bỏ drawing để dùng renderer linh kiện; chưa lưu bản lệch dữ liệu."] };
  return { diagram: { ...parsed.diagram, sourceImage: original.sourceImage, reviewStatus: "draft" }, errors: parsed.errors };
}
